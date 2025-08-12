/**
 * Test Suite for ML Models
 */

// Mock TensorFlow.js before importing models
jest.mock('@tensorflow/tfjs-node', () => ({
  sequential: jest.fn(() => ({
    layers: [],
    compile: jest.fn(),
    fit: jest.fn(() => Promise.resolve({ history: { val_loss: [0.1] } })),
    predict: jest.fn(() => ({ data: jest.fn(() => Promise.resolve([0.5])) })),
    save: jest.fn(() => Promise.resolve()),
    dispose: jest.fn(),
    summary: jest.fn()
  })),
  layers: {
    lstm: jest.fn(() => ({})),
    dropout: jest.fn(() => ({})),
    dense: jest.fn(() => ({}))
  },
  train: {
    adam: jest.fn(() => ({}))
  },
  tensor3d: jest.fn(() => ({ 
    dispose: jest.fn(),
    shape: [1, 10, 1]
  })),
  tensor2d: jest.fn(() => ({ 
    dispose: jest.fn(),
    shape: [1, 1]
  })),
  loadLayersModel: jest.fn(() => Promise.resolve({
    predict: jest.fn(() => ({ data: jest.fn(() => Promise.resolve([0.5])) })),
    dispose: jest.fn()
  }))
}));

import {
  IsolationForestModel,
  LSTMModel,
  ClusteringModel,
  StatisticalModel,
  createModel
} from '../models';
import { ModelConfig } from '../../types';

describe('ML Models', () => {
  const basicConfig: ModelConfig = {
    type: 'isolation_forest',
    parameters: { isolationTreeCount: 10 },
    threshold: 0.6,
    autoTune: false
  };

  describe('IsolationForestModel', () => {
    let model: IsolationForestModel;

    beforeEach(() => {
      model = new IsolationForestModel(basicConfig);
    });

    test('should initialize successfully', async () => {
      await expect(model.initialize()).resolves.not.toThrow();
    });

    test('should train on data', async () => {
      await model.initialize();
      const trainingData = Array.from({ length: 100 }, () => [Math.random() * 100]);
      
      await expect(model.train(trainingData)).resolves.not.toThrow();
    });

    test('should make predictions', async () => {
      await model.initialize();
      const trainingData = Array.from({ length: 50 }, () => [50 + Math.random() * 10]);
      await model.train(trainingData);
      
      const prediction = await model.predict([100]); // Outlier
      expect(typeof prediction).toBe('number');
      expect(prediction).toBeGreaterThanOrEqual(0);
      expect(prediction).toBeLessThanOrEqual(1);
    });

    test('should return higher scores for outliers', async () => {
      await model.initialize();
      const trainingData = Array.from({ length: 100 }, () => [50 + Math.random() * 5]);
      await model.train(trainingData);
      
      const normalScore = await model.predict([52]);
      const outlierScore = await model.predict([200]);
      
      expect(outlierScore).toBeGreaterThan(normalScore);
    });
  });

  describe('LSTMModel', () => {
    let model: LSTMModel;

    beforeEach(() => {
      const lstmConfig: ModelConfig = {
        type: 'lstm',
        parameters: {
          lstmUnits: 16,
          sequenceLength: 5,
          epochs: 2
        },
        threshold: 0.6,
        autoTune: false
      };
      model = new LSTMModel(lstmConfig);
    });

    test('should initialize successfully', async () => {
      await expect(model.initialize()).resolves.not.toThrow();
    });

    test('should train on sequential data', async () => {
      await model.initialize();
      const trainingData = Array.from({ length: 20 }, (_, i) => [Math.sin(i * 0.1)]);
      
      await expect(model.train(trainingData)).resolves.not.toThrow();
    }, 10000); // Longer timeout for LSTM training

    test('should make predictions', async () => {
      await model.initialize();
      const trainingData = Array.from({ length: 20 }, (_, i) => [i]);
      await model.train(trainingData);
      
      const prediction = await model.predict([15, 16, 17, 18, 19]);
      expect(typeof prediction).toBe('number');
      expect(prediction).toBeGreaterThanOrEqual(0);
      expect(prediction).toBeLessThanOrEqual(1);
    }, 10000);
  });

  describe('ClusteringModel', () => {
    let model: ClusteringModel;

    beforeEach(() => {
      const clusterConfig: ModelConfig = {
        type: 'clustering',
        parameters: { clusterCount: 3 },
        threshold: 0.6,
        autoTune: false
      };
      model = new ClusteringModel(clusterConfig);
    });

    test('should initialize successfully', async () => {
      await expect(model.initialize()).resolves.not.toThrow();
    });

    test('should train and cluster data', async () => {
      await model.initialize();
      const trainingData = [
        ...Array.from({ length: 20 }, () => [10 + Math.random() * 5]), // Cluster 1
        ...Array.from({ length: 20 }, () => [50 + Math.random() * 5]), // Cluster 2
        ...Array.from({ length: 20 }, () => [90 + Math.random() * 5])  // Cluster 3
      ];
      
      await expect(model.train(trainingData)).resolves.not.toThrow();
    });

    test('should detect outliers from clusters', async () => {
      await model.initialize();
      const trainingData = Array.from({ length: 60 }, () => [50 + Math.random() * 10]);
      await model.train(trainingData);
      
      const normalScore = await model.predict([55]);
      const outlierScore = await model.predict([200]);
      
      expect(outlierScore).toBeGreaterThan(normalScore);
    });
  });

  describe('Model Factory', () => {
    test('should create isolation forest model', () => {
      const model = createModel({ ...basicConfig, type: 'isolation_forest' });
      expect(model).toBeInstanceOf(IsolationForestModel);
    });

    test('should create clustering model', () => {
      const model = createModel({ ...basicConfig, type: 'clustering' });
      expect(model).toBeInstanceOf(ClusteringModel);
    });

    test('should create LSTM model', () => {
      const model = createModel({ ...basicConfig, type: 'lstm' });
      expect(model).toBeInstanceOf(LSTMModel);
    });

    test('should create statistical model as fallback', () => {
      const model = createModel({ ...basicConfig, type: 'unknown' as any });
      expect(model).toBeInstanceOf(StatisticalModel);
    });
  });
});