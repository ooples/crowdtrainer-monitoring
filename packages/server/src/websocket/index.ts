import { FastifyInstance } from 'fastify';
import { WebSocket } from 'ws';
import { getRedis } from '../redis';
import { getAuthManager } from '../auth';
import { WebSocketMessage, WebSocketMessageSchema } from '../types';

interface WebSocketClient {
  id: string;
  socket: WebSocket;
  subscriptions: Set<string>;
  metadata: {
    connectedAt: Date;
    lastPing: Date;
    ip: string;
    userAgent?: string;
    apiKey?: string;
  };
}

interface WebSocketConfig {
  heartbeatInterval: number;
  maxConnections: number;
}

export class WebSocketManager {
  private clients: Map<string, WebSocketClient> = new Map();
  private redis = getRedis();
  private auth = getAuthManager();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private config: WebSocketConfig;

  constructor(config: WebSocketConfig) {
    this.config = config;
    this.startHeartbeat();
    this.setupRedisSubscriptions();
  }

  // Initialize WebSocket routes
  async initializeRoutes(fastify: FastifyInstance): Promise<void> {
    // Main WebSocket endpoint
    const self = this;
    await fastify.register(async function (fastify) {
      fastify.get('/ws', { websocket: true }, async (connection, request) => {
        await self.handleConnection(connection, request);
      });
    });

    // WebSocket with authentication
    await fastify.register(async function (fastify) {
      fastify.get('/ws/authenticated', { websocket: true }, async (connection, request) => {
        // Verify API key from query parameters
        const apiKey = (request.query as Record<string, any>)?.apiKey as string;
        if (!apiKey) {
          connection.close(1008, 'API key required');
          return;
        }

        const validApiKey = await self.auth.authenticateApiKey(apiKey);
        if (!validApiKey) {
          connection.close(1008, 'Invalid API key');
          return;
        }

        await self.handleConnection(connection, request, validApiKey.id);
      });
    });
  }

  // Handle new WebSocket connection
  private async handleConnection(
    connection: WebSocket,
    request: any,
    apiKeyId?: string
  ): Promise<void> {
    // Check connection limit
    if (this.clients.size >= this.config.maxConnections) {
      connection.close(1013, 'Server capacity exceeded');
      return;
    }

    const clientId = this.generateClientId();
    const metadata: WebSocketClient['metadata'] = {
      connectedAt: new Date(),
      lastPing: new Date(),
      ip: request.ip || 'unknown',
    };

    if (request.headers['user-agent']) {
      metadata.userAgent = request.headers['user-agent'];
    }

    if (apiKeyId) {
      metadata.apiKey = apiKeyId;
    }

    const client: WebSocketClient = {
      id: clientId,
      socket: connection,
      subscriptions: new Set(),
      metadata,
    };

    this.clients.set(clientId, client);

    // Store connection info in Redis
    await this.redis.addWebSocketConnection(clientId, {
      connectedAt: client.metadata.connectedAt.toISOString(),
      ip: client.metadata.ip,
      userAgent: client.metadata.userAgent,
      apiKey: apiKeyId,
    });

    console.log(`WebSocket client connected: ${clientId} (${this.clients.size} total)`);

    // Send welcome message
    this.sendToClient(clientId, {
      type: 'heartbeat',
      data: {
        message: 'Connected to monitoring API',
        clientId,
        serverTime: new Date().toISOString(),
      },
    });

    // Set up connection event handlers
    connection.on('message', (data) => {
      this.handleMessage(clientId, data);
    });

    connection.on('close', (code, reason) => {
      this.handleDisconnection(clientId, code, reason);
    });

    connection.on('error', (error) => {
      console.error(`WebSocket error for client ${clientId}:`, error);
      this.handleDisconnection(clientId, 1011, 'Internal error');
    });

    connection.on('pong', () => {
      const client = this.clients.get(clientId);
      if (client) {
        client.metadata.lastPing = new Date();
      }
    });
  }

  // Handle incoming WebSocket message
  private async handleMessage(clientId: string, data: any): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      const message = JSON.parse(data.toString());
      const validatedMessage = WebSocketMessageSchema.parse(message);

      switch (validatedMessage.type) {
        case 'subscribe':
          await this.handleSubscription(clientId, validatedMessage);
          break;
        
        case 'unsubscribe':
          await this.handleUnsubscription(clientId, validatedMessage);
          break;
        
        case 'heartbeat':
          this.handleHeartbeat(clientId, validatedMessage);
          break;
        
        case 'event':
        case 'metric':
        case 'alert':
          // Clients can send events/metrics if they have write permissions
          await this.handleClientData(clientId, validatedMessage);
          break;
        
        default:
          this.sendToClient(clientId, {
            type: 'heartbeat',
            data: {
              error: 'Unknown message type',
              received: validatedMessage.type,
            },
          });
      }
    } catch (error) {
      console.error(`Error handling message from client ${clientId}:`, error);
      this.sendToClient(clientId, {
        type: 'heartbeat',
        data: {
          error: 'Invalid message format',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  // Handle subscription requests
  private async handleSubscription(clientId: string, message: WebSocketMessage): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    const channel = message.channel;
    if (!channel) {
      this.sendToClient(clientId, {
        type: 'heartbeat',
        data: { error: 'Channel is required for subscription' },
      });
      return;
    }

    // Validate subscription permissions
    if (!await this.validateSubscriptionPermissions(client, channel)) {
      this.sendToClient(clientId, {
        type: 'heartbeat',
        data: { error: 'Insufficient permissions for channel' },
      });
      return;
    }

    client.subscriptions.add(channel);
    
    this.sendToClient(clientId, {
      type: 'heartbeat',
      data: {
        message: `Subscribed to ${channel}`,
        subscriptions: Array.from(client.subscriptions),
      },
    });

    console.log(`Client ${clientId} subscribed to ${channel}`);
  }

  // Handle unsubscription requests
  private async handleUnsubscription(clientId: string, message: WebSocketMessage): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    const channel = message.channel;
    if (!channel) {
      this.sendToClient(clientId, {
        type: 'heartbeat',
        data: { error: 'Channel is required for unsubscription' },
      });
      return;
    }

    client.subscriptions.delete(channel);
    
    this.sendToClient(clientId, {
      type: 'heartbeat',
      data: {
        message: `Unsubscribed from ${channel}`,
        subscriptions: Array.from(client.subscriptions),
      },
    });

    console.log(`Client ${clientId} unsubscribed from ${channel}`);
  }

  // Handle heartbeat messages
  private handleHeartbeat(clientId: string, message: WebSocketMessage): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.metadata.lastPing = new Date();
    
    this.sendToClient(clientId, {
      type: 'heartbeat',
      data: {
        message: 'pong',
        serverTime: new Date().toISOString(),
        clientTime: message.data?.clientTime,
      },
    });
  }

  // Handle client data (events, metrics, alerts)
  private async handleClientData(clientId: string, message: WebSocketMessage): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Check if client has write permissions
    if (client.metadata.apiKey) {
      const apiKey = await this.auth.authenticateApiKey(client.metadata.apiKey);
      if (!apiKey || !this.auth.hasPermission(apiKey, 'write')) {
        this.sendToClient(clientId, {
          type: 'heartbeat',
          data: { error: 'Write permission required' },
        });
        return;
      }
    } else {
      this.sendToClient(clientId, {
        type: 'heartbeat',
        data: { error: 'Authentication required for sending data' },
      });
      return;
    }

    // Process the data based on type
    switch (message.type) {
      case 'event':
        await this.redis.queueEvent(message.data);
        break;
      case 'metric':
        // Handle metric data
        await this.redis.publish('metrics:realtime', message.data);
        break;
      case 'alert':
        // Handle alert data
        await this.redis.publish('alerts:realtime', message.data);
        break;
    }

    this.sendToClient(clientId, {
      type: 'heartbeat',
      data: { message: `${message.type} received and processed` },
    });
  }

  // Validate subscription permissions
  private async validateSubscriptionPermissions(client: WebSocketClient, channel: string): Promise<boolean> {
    // Public channels that don't require authentication
    const publicChannels = ['system:health', 'system:status'];
    
    if (publicChannels.includes(channel)) {
      return true;
    }

    // Check if client is authenticated
    if (!client.metadata.apiKey) {
      return false;
    }

    const apiKey = await this.auth.authenticateApiKey(client.metadata.apiKey);
    if (!apiKey) {
      return false;
    }

    // Admin can subscribe to everything
    if (this.auth.hasPermission(apiKey, 'admin')) {
      return true;
    }

    // Check specific channel permissions
    if (channel.startsWith('events:') && this.auth.hasPermission(apiKey, 'read')) {
      return true;
    }

    if (channel.startsWith('metrics:') && this.auth.hasPermission(apiKey, 'read')) {
      return true;
    }

    if (channel.startsWith('alerts:') && this.auth.hasPermission(apiKey, 'read')) {
      return true;
    }

    return false;
  }

  // Handle client disconnection
  private async handleDisconnection(clientId: string, code: number, reason: any): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    console.log(`WebSocket client disconnected: ${clientId} (code: ${code}, reason: ${reason})`);

    // Remove from Redis
    await this.redis.removeWebSocketConnection(clientId);

    // Remove from clients map
    this.clients.delete(clientId);

    console.log(`WebSocket clients remaining: ${this.clients.size}`);
  }

  // Send message to specific client
  private sendToClient(clientId: string, message: WebSocketMessage): void {
    const client = this.clients.get(clientId);
    if (!client || client.socket.readyState !== WebSocket.OPEN) return;

    try {
      const messageWithTimestamp = {
        ...message,
        timestamp: new Date().toISOString(),
      };
      
      client.socket.send(JSON.stringify(messageWithTimestamp));
    } catch (error) {
      console.error(`Error sending message to client ${clientId}:`, error);
      this.handleDisconnection(clientId, 1011, 'Send error');
    }
  }

  // Broadcast message to all subscribers of a channel
  public broadcast(channel: string, message: WebSocketMessage): void {
    const subscribedClients = Array.from(this.clients.values()).filter(
      client => client.subscriptions.has(channel)
    );

    subscribedClients.forEach(client => {
      this.sendToClient(client.id, {
        ...message,
        channel,
      });
    });

    console.log(`Broadcasted to ${subscribedClients.length} clients on channel ${channel}`);
  }

  // Send message to all connected clients
  public broadcastToAll(message: WebSocketMessage): void {
    this.clients.forEach((_, clientId) => {
      this.sendToClient(clientId, message);
    });
  }

  // Setup Redis subscriptions for real-time data
  private async setupRedisSubscriptions(): Promise<void> {
    // Subscribe to real-time events
    await this.redis.subscribe('events:realtime', (data: any) => {
      this.broadcast('events:realtime', {
        type: 'event',
        data,
      });
    });

    // Subscribe to real-time metrics
    await this.redis.subscribe('metrics:realtime', (data: any) => {
      this.broadcast('metrics:realtime', {
        type: 'metric',
        data,
      });
    });

    // Subscribe to real-time alerts
    await this.redis.subscribe('alerts:realtime', (data: any) => {
      this.broadcast('alerts:realtime', {
        type: 'alert',
        data,
      });
    });

    // Subscribe to system events
    await this.redis.subscribe('system:health', (data: any) => {
      this.broadcast('system:health', {
        type: 'event',
        data,
      });
    });

    console.log('WebSocket Redis subscriptions established');
  }

  // Start heartbeat mechanism
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.performHeartbeat();
    }, this.config.heartbeatInterval);

    console.log(`WebSocket heartbeat started (${this.config.heartbeatInterval}ms interval)`);
  }

  // Perform heartbeat check
  private performHeartbeat(): void {
    const now = new Date();
    const timeoutThreshold = this.config.heartbeatInterval * 2; // 2 intervals timeout

    this.clients.forEach((client, clientId) => {
      const timeSinceLastPing = now.getTime() - client.metadata.lastPing.getTime();
      
      if (timeSinceLastPing > timeoutThreshold) {
        console.log(`Client ${clientId} timed out, disconnecting`);
        this.handleDisconnection(clientId, 1000, 'Heartbeat timeout');
        return;
      }

      // Send ping
      if (client.socket.readyState === WebSocket.OPEN) {
        try {
          client.socket.ping();
        } catch (error) {
          console.error(`Error sending ping to client ${clientId}:`, error);
          this.handleDisconnection(clientId, 1011, 'Ping error');
        }
      }
    });
  }

  // Generate unique client ID
  private generateClientId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get connection statistics
  public getStats(): {
    totalConnections: number;
    activeConnections: number;
    subscriptions: Record<string, number>;
  } {
    const subscriptions: Record<string, number> = {};
    
    this.clients.forEach(client => {
      client.subscriptions.forEach(channel => {
        subscriptions[channel] = (subscriptions[channel] || 0) + 1;
      });
    });

    return {
      totalConnections: this.clients.size,
      activeConnections: Array.from(this.clients.values()).filter(
        client => client.socket.readyState === WebSocket.OPEN
      ).length,
      subscriptions,
    };
  }

  // Cleanup
  public async cleanup(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Close all connections
    this.clients.forEach((client) => {
      client.socket.close(1001, 'Server shutting down');
    });

    this.clients.clear();
    console.log('WebSocket manager cleaned up');
  }
}

let wsManager: WebSocketManager;

export async function initWebSocket(
  fastify: FastifyInstance,
  config: WebSocketConfig
): Promise<Set<WebSocketClient>> {
  wsManager = new WebSocketManager(config);
  await wsManager.initializeRoutes(fastify);
  
  // Return a Set-like interface for compatibility
  return new Set() as Set<WebSocketClient>;
}

export function getWebSocketManager(): WebSocketManager {
  if (!wsManager) {
    throw new Error('WebSocket manager not initialized');
  }
  return wsManager;
}