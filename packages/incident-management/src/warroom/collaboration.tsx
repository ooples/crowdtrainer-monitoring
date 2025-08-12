import React, { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import {
  Incident,
  WarRoomState,
  WarRoomParticipant,
  WarRoomMessage,
  IncidentManagementConfig,
  WarRoomEventPayload,
} from '../types';

interface WarRoomProps {
  incident: Incident;
  currentUser: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  config: IncidentManagementConfig;
  onIncidentUpdate: (incident: Incident) => void;
}

interface ChatMessage extends WarRoomMessage {
  user?: WarRoomParticipant;
}

export const WarRoomCollaboration: React.FC<WarRoomProps> = ({
  incident,
  currentUser,
  config,
  onIncidentUpdate,
}) => {
  const [warRoom, setWarRoom] = useState<WarRoomState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [participants, setParticipants] = useState<WarRoomParticipant[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [videoCallUrl, setVideoCallUrl] = useState<string | null>(null);
  const [sharedDocuments, setSharedDocuments] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [actionItems, setActionItems] = useState<string[]>([]);
  
  const socket = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize socket connection
  useEffect(() => {
    const socketUrl = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001';
    
    socket.current = io(socketUrl, {
      query: {
        incidentId: incident.id,
        userId: currentUser.id,
      },
    });

    socket.current.on('connect', () => {
      setIsConnected(true);
      joinWarRoom();
    });

    socket.current.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.current.on('warroom_state', handleWarRoomState);
    socket.current.on('participant_joined', handleParticipantJoined);
    socket.current.on('participant_left', handleParticipantLeft);
    socket.current.on('new_message', handleNewMessage);
    socket.current.on('incident_updated', handleIncidentUpdated);
    socket.current.on('document_shared', handleDocumentShared);
    socket.current.on('video_call_started', handleVideoCallStarted);
    socket.current.on('recording_toggled', handleRecordingToggled);

    return () => {
      if (socket.current) {
        socket.current.disconnect();
      }
    };
  }, [incident.id, currentUser.id]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const joinWarRoom = useCallback(() => {
    if (!socket.current) return;

    const participant: WarRoomParticipant = {
      id: currentUser.id,
      name: currentUser.name,
      email: currentUser.email,
      avatar: currentUser.avatar,
      role: 'responder', // Default role, can be updated
      joinedAt: new Date(),
      lastActive: new Date(),
    };

    socket.current.emit('join_warroom', {
      incidentId: incident.id,
      participant,
    });
  }, [incident.id, currentUser]);

  const handleWarRoomState = useCallback((state: WarRoomState) => {
    setWarRoom(state);
    setParticipants(state.participants);
    setMessages(state.messages.map(msg => ({
      ...msg,
      user: state.participants.find(p => p.id === msg.userId),
    })));
    setSharedDocuments(state.documentsShared);
    setVideoCallUrl(state.videoCallUrl || null);
  }, []);

  const handleParticipantJoined = useCallback((participant: WarRoomParticipant) => {
    setParticipants(prev => [...prev.filter(p => p.id !== participant.id), participant]);
    
    const systemMessage: ChatMessage = {
      id: uuidv4(),
      incidentId: incident.id,
      userId: 'system',
      content: `${participant.name} joined the war room`,
      type: 'system',
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, systemMessage]);
  }, [incident.id]);

  const handleParticipantLeft = useCallback((participantId: string) => {
    const participant = participants.find(p => p.id === participantId);
    if (participant) {
      setParticipants(prev => prev.filter(p => p.id !== participantId));
      
      const systemMessage: ChatMessage = {
        id: uuidv4(),
        incidentId: incident.id,
        userId: 'system',
        content: `${participant.name} left the war room`,
        type: 'system',
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, systemMessage]);
    }
  }, [participants, incident.id]);

  const handleNewMessage = useCallback((message: WarRoomMessage) => {
    const participant = participants.find(p => p.id === message.userId);
    setMessages(prev => [...prev, { ...message, user: participant }]);
  }, [participants]);

  const handleIncidentUpdated = useCallback((updatedIncident: Incident) => {
    onIncidentUpdate(updatedIncident);
    
    const systemMessage: ChatMessage = {
      id: uuidv4(),
      incidentId: incident.id,
      userId: 'system',
      content: `Incident status updated to: ${updatedIncident.status}`,
      type: 'status_update',
      timestamp: new Date(),
      metadata: { previousStatus: incident.status, newStatus: updatedIncident.status },
    };
    
    setMessages(prev => [...prev, systemMessage]);
  }, [incident, onIncidentUpdate]);

  const handleDocumentShared = useCallback((documentUrl: string) => {
    setSharedDocuments(prev => [...prev, documentUrl]);
    
    const systemMessage: ChatMessage = {
      id: uuidv4(),
      incidentId: incident.id,
      userId: 'system',
      content: `Document shared: ${documentUrl}`,
      type: 'system',
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, systemMessage]);
  }, [incident.id]);

  const handleVideoCallStarted = useCallback((callUrl: string) => {
    setVideoCallUrl(callUrl);
    
    const systemMessage: ChatMessage = {
      id: uuidv4(),
      incidentId: incident.id,
      userId: 'system',
      content: `Video call started`,
      type: 'system',
      timestamp: new Date(),
      metadata: { callUrl },
    };
    
    setMessages(prev => [...prev, systemMessage]);
  }, [incident.id]);

  const handleRecordingToggled = useCallback((recording: boolean) => {
    setIsRecording(recording);
    
    const systemMessage: ChatMessage = {
      id: uuidv4(),
      incidentId: incident.id,
      userId: 'system',
      content: recording ? 'Recording started' : 'Recording stopped',
      type: 'system',
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, systemMessage]);
  }, [incident.id]);

  const sendMessage = useCallback(() => {
    if (!currentMessage.trim() || !socket.current) return;

    const message: WarRoomMessage = {
      id: uuidv4(),
      incidentId: incident.id,
      userId: currentUser.id,
      content: currentMessage.trim(),
      type: 'message',
      timestamp: new Date(),
    };

    socket.current.emit('send_message', message);
    setCurrentMessage('');
  }, [currentMessage, incident.id, currentUser.id]);

  const updateIncidentStatus = useCallback((newStatus: string) => {
    if (!socket.current) return;

    const updatedIncident = { ...incident, status: newStatus as any, updatedAt: new Date() };
    socket.current.emit('update_incident', updatedIncident);
  }, [incident]);

  const startVideoCall = useCallback(() => {
    if (!socket.current) return;

    socket.current.emit('start_video_call', {
      incidentId: incident.id,
      provider: config.warRoom.videoIntegration,
    });
  }, [incident.id, config.warRoom.videoIntegration]);

  const toggleRecording = useCallback(() => {
    if (!socket.current) return;

    socket.current.emit('toggle_recording', {
      incidentId: incident.id,
      recording: !isRecording,
    });
  }, [incident.id, isRecording]);

  const shareDocument = useCallback((file: File) => {
    if (!socket.current) return;

    // In a real implementation, you'd upload the file first
    const documentUrl = `https://docs.example.com/${file.name}`;
    
    socket.current.emit('share_document', {
      incidentId: incident.id,
      documentUrl,
      fileName: file.name,
      sharedBy: currentUser.id,
    });
  }, [incident.id, currentUser.id]);

  const addActionItem = useCallback((action: string) => {
    if (!action.trim() || !socket.current) return;

    socket.current.emit('add_action_item', {
      incidentId: incident.id,
      action: action.trim(),
      assignedTo: currentUser.id,
    });

    setActionItems(prev => [...prev, action.trim()]);
  }, [incident.id, currentUser.id]);

  const formatTimestamp = (timestamp: Date) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getMessageTypeClass = (type: string) => {
    switch (type) {
      case 'system':
        return 'bg-gray-100 text-gray-600 italic';
      case 'status_update':
        return 'bg-blue-100 text-blue-800 font-semibold';
      case 'action':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-white text-gray-900';
    }
  };

  return (
    <div className="war-room-collaboration flex h-screen bg-gray-50">
      {/* Sidebar - Participants and Actions */}
      <div className="w-1/4 bg-white border-r border-gray-200 flex flex-col">
        {/* Connection Status */}
        <div className={`p-4 text-center text-sm font-medium ${
          isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
        </div>

        {/* Incident Info */}
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-bold text-lg mb-2">Incident #{incident.id.slice(-8)}</h2>
          <p className="text-sm text-gray-600 mb-2">{incident.title}</p>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              incident.severity === 'P1_CRITICAL' ? 'bg-red-100 text-red-800' :
              incident.severity === 'P2_HIGH' ? 'bg-orange-100 text-orange-800' :
              incident.severity === 'P3_MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {incident.severity}
            </span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              incident.status === 'resolved' ? 'bg-green-100 text-green-800' :
              'bg-blue-100 text-blue-800'
            }`}>
              {incident.status}
            </span>
          </div>
        </div>

        {/* Participants */}
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold mb-2">Participants ({participants.length})</h3>
          <div className="space-y-2">
            {participants.map(participant => (
              <div key={participant.id} className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                  {participant.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {participant.name}
                  </p>
                  <p className="text-xs text-gray-500">{participant.role}</p>
                </div>
                <div className={`w-2 h-2 rounded-full ${
                  Date.now() - participant.lastActive.getTime() < 5 * 60 * 1000 
                    ? 'bg-green-400' : 'bg-gray-400'
                }`} />
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold mb-2">Quick Actions</h3>
          <div className="space-y-2">
            <select
              className="w-full p-2 border border-gray-300 rounded-md text-sm"
              value={incident.status}
              onChange={(e) => updateIncidentStatus(e.target.value)}
            >
              <option value="investigating">Investigating</option>
              <option value="identified">Identified</option>
              <option value="monitoring">Monitoring</option>
              <option value="resolved">Resolved</option>
            </select>
            
            {config.warRoom.videoIntegration !== 'none' && (
              <button
                onClick={startVideoCall}
                className="w-full p-2 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600"
                disabled={!!videoCallUrl}
              >
                {videoCallUrl ? 'Call Active' : 'Start Video Call'}
              </button>
            )}

            {config.warRoom.autoRecording && (
              <button
                onClick={toggleRecording}
                className={`w-full p-2 rounded-md text-sm ${
                  isRecording 
                    ? 'bg-red-500 text-white hover:bg-red-600' 
                    : 'bg-gray-500 text-white hover:bg-gray-600'
                }`}
              >
                {isRecording ? 'Stop Recording' : 'Start Recording'}
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) shareDocument(file);
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full p-2 bg-gray-500 text-white rounded-md text-sm hover:bg-gray-600"
            >
              Share Document
            </button>
          </div>
        </div>

        {/* Shared Documents */}
        {sharedDocuments.length > 0 && (
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold mb-2">Shared Documents</h3>
            <div className="space-y-1">
              {sharedDocuments.map((doc, index) => (
                <a
                  key={index}
                  href={doc}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm text-blue-600 hover:text-blue-800 truncate"
                >
                  📄 {doc.split('/').pop()}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">War Room - {incident.title}</h1>
            {videoCallUrl && (
              <a
                href={videoCallUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
              >
                Join Video Call
              </a>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map(message => (
            <div
              key={message.id}
              className={`p-3 rounded-lg max-w-3xl ${getMessageTypeClass(message.type)} ${
                message.userId === currentUser.id ? 'ml-auto' : 'mr-auto'
              }`}
            >
              {message.user && (
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{message.user.name}</span>
                  <span className="text-xs text-gray-500">
                    {formatTimestamp(message.timestamp)}
                  </span>
                </div>
              )}
              <p className="text-sm">{message.content}</p>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="bg-white border-t border-gray-200 p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={currentMessage}
              onChange={(e) => setCurrentMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Type a message..."
              className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={!isConnected}
            />
            <button
              onClick={sendMessage}
              disabled={!currentMessage.trim() || !isConnected}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>
          
          {/* Quick message templates */}
          <div className="mt-2 flex gap-2 flex-wrap">
            {['Status update needed', 'Escalating to next level', 'Issue resolved', 'Need more info'].map(template => (
              <button
                key={template}
                onClick={() => setCurrentMessage(template)}
                className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              >
                {template}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Server-side Socket.IO handler (Node.js/Express)
export class WarRoomServer {
  private io: any; // Socket.IO server instance
  private warRooms: Map<string, WarRoomState> = new Map();
  private redis: any; // Redis client

  constructor(io: any, redis: any) {
    this.io = io;
    this.redis = redis;
    this.setupSocketHandlers();
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket: any) => {
      socket.on('join_warroom', async (data: { incidentId: string; participant: WarRoomParticipant }) => {
        await this.handleJoinWarRoom(socket, data);
      });

      socket.on('send_message', async (message: WarRoomMessage) => {
        await this.handleSendMessage(socket, message);
      });

      socket.on('update_incident', async (incident: Incident) => {
        await this.handleUpdateIncident(socket, incident);
      });

      socket.on('start_video_call', async (data: { incidentId: string; provider: string }) => {
        await this.handleStartVideoCall(socket, data);
      });

      socket.on('toggle_recording', async (data: { incidentId: string; recording: boolean }) => {
        await this.handleToggleRecording(socket, data);
      });

      socket.on('share_document', async (data: { incidentId: string; documentUrl: string; fileName: string; sharedBy: string }) => {
        await this.handleShareDocument(socket, data);
      });

      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  private async handleJoinWarRoom(socket: any, data: { incidentId: string; participant: WarRoomParticipant }): Promise<void> {
    const { incidentId, participant } = data;
    
    socket.join(`warroom:${incidentId}`);
    socket.incidentId = incidentId;
    socket.userId = participant.id;

    let warRoom = this.warRooms.get(incidentId);
    if (!warRoom) {
      warRoom = {
        id: uuidv4(),
        incidentId,
        participants: [],
        messages: [],
        documentsShared: [],
        activeActions: [],
        createdAt: new Date(),
      };
      this.warRooms.set(incidentId, warRoom);
    }

    // Add or update participant
    const existingIndex = warRoom.participants.findIndex(p => p.id === participant.id);
    if (existingIndex >= 0) {
      warRoom.participants[existingIndex] = { ...participant, lastActive: new Date() };
    } else {
      warRoom.participants.push({ ...participant, lastActive: new Date() });
    }

    // Send current state to joining user
    socket.emit('warroom_state', warRoom);

    // Notify others
    socket.to(`warroom:${incidentId}`).emit('participant_joined', participant);

    // Store in Redis
    await this.redis.hset('warrooms', incidentId, JSON.stringify(warRoom));
  }

  private async handleSendMessage(socket: any, message: WarRoomMessage): Promise<void> {
    const warRoom = this.warRooms.get(message.incidentId);
    if (!warRoom) return;

    // Update sender's last active
    const participant = warRoom.participants.find(p => p.id === message.userId);
    if (participant) {
      participant.lastActive = new Date();
    }

    warRoom.messages.push(message);

    // Broadcast to all participants
    this.io.to(`warroom:${message.incidentId}`).emit('new_message', message);

    // Store in Redis
    await this.redis.hset('warrooms', message.incidentId, JSON.stringify(warRoom));
    await this.redis.lpush(`messages:${message.incidentId}`, JSON.stringify(message));
  }

  private async handleUpdateIncident(socket: any, incident: Incident): Promise<void> {
    // Store updated incident
    await this.redis.hset('incidents', incident.id, JSON.stringify(incident));

    // Broadcast to all participants
    this.io.to(`warroom:${incident.id}`).emit('incident_updated', incident);
  }

  private async handleStartVideoCall(socket: any, data: { incidentId: string; provider: string }): Promise<void> {
    const warRoom = this.warRooms.get(data.incidentId);
    if (!warRoom) return;

    // Generate video call URL based on provider
    let callUrl: string;
    switch (data.provider) {
      case 'zoom':
        callUrl = `https://zoom.us/j/${Date.now()}`;
        break;
      case 'teams':
        callUrl = `https://teams.microsoft.com/l/meetup-join/${Date.now()}`;
        break;
      case 'meet':
        callUrl = `https://meet.google.com/${uuidv4().slice(0, 10)}`;
        break;
      default:
        return;
    }

    warRoom.videoCallUrl = callUrl;

    // Broadcast to all participants
    this.io.to(`warroom:${data.incidentId}`).emit('video_call_started', callUrl);

    // Store in Redis
    await this.redis.hset('warrooms', data.incidentId, JSON.stringify(warRoom));
  }

  private async handleToggleRecording(socket: any, data: { incidentId: string; recording: boolean }): Promise<void> {
    // In a real implementation, you'd integrate with your video provider's recording API
    this.io.to(`warroom:${data.incidentId}`).emit('recording_toggled', data.recording);
  }

  private async handleShareDocument(socket: any, data: { incidentId: string; documentUrl: string; fileName: string; sharedBy: string }): Promise<void> {
    const warRoom = this.warRooms.get(data.incidentId);
    if (!warRoom) return;

    warRoom.documentsShared.push(data.documentUrl);

    // Broadcast to all participants
    this.io.to(`warroom:${data.incidentId}`).emit('document_shared', data.documentUrl);

    // Store in Redis
    await this.redis.hset('warrooms', data.incidentId, JSON.stringify(warRoom));
  }

  private handleDisconnect(socket: any): void {
    if (socket.incidentId && socket.userId) {
      const warRoom = this.warRooms.get(socket.incidentId);
      if (warRoom) {
        // Remove participant
        warRoom.participants = warRoom.participants.filter(p => p.id !== socket.userId);
        
        // Notify others
        socket.to(`warroom:${socket.incidentId}`).emit('participant_left', socket.userId);
      }
    }
  }
}

export default WarRoomCollaboration;