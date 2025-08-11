import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { MonitoringProvider } from './providers/MonitoringProvider';
import { ErrorBoundary } from './components/ErrorBoundary';
import HomeScreen from './screens/HomeScreen';
import AnalyticsScreen from './screens/AnalyticsScreen';
import DemoScreen from './screens/DemoScreen';
import SettingsScreen from './screens/SettingsScreen';
import { monitoringConfig } from './config/monitoring';
import { initializeGlobalErrorHandling } from './utils/errorHandling';
import './utils/performanceMonitoring';

const Tab = createBottomTabNavigator();

function App(): JSX.Element {
  useEffect(() => {
    // Initialize global error handling
    initializeGlobalErrorHandling();
  }, []);

  return (
    <ErrorBoundary>
      <MonitoringProvider config={monitoringConfig}>
        <NavigationContainer>
          <Tab.Navigator
            screenOptions={({ route }) => ({
              tabBarIcon: ({ focused, color, size }) => {
                let iconName;

                if (route.name === 'Home') {
                  iconName = 'home';
                } else if (route.name === 'Analytics') {
                  iconName = 'analytics';
                } else if (route.name === 'Demo') {
                  iconName = 'science';
                } else if (route.name === 'Settings') {
                  iconName = 'settings';
                }

                return <Icon name={iconName || 'circle'} size={size} color={color} />;
              },
              tabBarActiveTintColor: '#2563eb',
              tabBarInactiveTintColor: 'gray',
              headerStyle: {
                backgroundColor: '#f8fafc',
              },
              headerTintColor: '#1f2937',
              headerTitleStyle: {
                fontWeight: 'bold',
              },
            })}
          >
            <Tab.Screen 
              name="Home" 
              component={HomeScreen}
              options={{ title: 'Home' }}
            />
            <Tab.Screen 
              name="Demo" 
              component={DemoScreen}
              options={{ title: 'Demo' }}
            />
            <Tab.Screen 
              name="Analytics" 
              component={AnalyticsScreen}
              options={{ title: 'Analytics' }}
            />
            <Tab.Screen 
              name="Settings" 
              component={SettingsScreen}
              options={{ title: 'Settings' }}
            />
          </Tab.Navigator>
        </NavigationContainer>
      </MonitoringProvider>
    </ErrorBoundary>
  );
}

export default App;