import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useMonitoring } from '../providers/MonitoringProvider';
import { useUserJourney } from '../providers/UserJourneyProvider';

const Header: React.FC = () => {
  const location = useLocation();
  const { track } = useMonitoring();
  const { trackUserInteraction } = useUserJourney();

  const handleNavClick = (destination: string) => {
    // Track navigation click
    trackUserInteraction('navigation_click', {
      from: location.pathname,
      to: destination,
      nav_type: 'header_menu',
    });

    track({
      category: 'navigation',
      action: 'menu_click',
      label: destination,
      metadata: {
        current_page: location.pathname,
      },
    });
  };

  const navItems = [
    { path: '/', label: 'Home' },
    { path: '/about', label: 'About' },
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/contact', label: 'Contact' },
  ];

  return (
    <header className="header">
      <nav className="nav">
        <div className="nav-brand">
          <Link 
            to="/" 
            onClick={() => handleNavClick('/')}
            className="brand-link"
          >
            React SPA Monitor
          </Link>
        </div>
        
        <ul className="nav-menu">
          {navItems.map(item => (
            <li key={item.path} className="nav-item">
              <Link
                to={item.path}
                onClick={() => handleNavClick(item.path)}
                className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="nav-actions">
          <button
            className="btn btn-primary"
            onClick={() => {
              trackUserInteraction('cta_click', {
                cta_type: 'get_started',
                location: 'header',
              });
              
              track({
                category: 'conversion',
                action: 'cta_click',
                label: 'get_started_header',
              });
            }}
          >
            Get Started
          </button>
        </div>
      </nav>
    </header>
  );
};

export default Header;