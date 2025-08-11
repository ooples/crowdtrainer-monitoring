import React, { useState } from 'react';
import { useMonitoring } from '../providers/MonitoringProvider';
import { useUserJourney } from '../providers/UserJourneyProvider';

interface FormData {
  name: string;
  email: string;
  message: string;
}

const ContactPage: React.FC = () => {
  const { track, trackError } = useMonitoring();
  const { trackUserInteraction } = useUserJourney();
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleInputChange = (field: keyof FormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: e.target.value,
    }));

    // Track form interaction
    trackUserInteraction('form_field_interaction', {
      field,
      form: 'contact_form',
      value_length: e.target.value.length,
    });
  };

  const validateForm = (): boolean => {
    const errors: string[] = [];
    
    if (!formData.name.trim()) errors.push('Name is required');
    if (!formData.email.trim()) errors.push('Email is required');
    if (!formData.email.includes('@')) errors.push('Valid email is required');
    if (!formData.message.trim()) errors.push('Message is required');

    if (errors.length > 0) {
      // Track validation errors
      track({
        category: 'form_validation',
        action: 'validation_failed',
        label: 'contact_form',
        metadata: {
          errors,
          field_completion: {
            name: !!formData.name.trim(),
            email: !!formData.email.trim(),
            message: !!formData.message.trim(),
          },
        },
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    const startTime = performance.now();

    try {
      // Track form submission start
      track({
        category: 'form_submission',
        action: 'submission_started',
        label: 'contact_form',
        metadata: {
          form_completion_rate: {
            name: formData.name.length > 0 ? 100 : 0,
            email: formData.email.length > 0 ? 100 : 0,
            message: formData.message.length > 0 ? 100 : 0,
          },
        },
      });

      // Simulate form submission delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Simulate occasional form submission errors (10% chance)
      if (Math.random() < 0.1) {
        throw new Error('Simulated server error during form submission');
      }

      const submissionTime = performance.now() - startTime;

      // Track successful submission
      track({
        category: 'conversion',
        action: 'contact_form_submitted',
        value: Math.round(submissionTime),
        metadata: {
          form_data: {
            name_length: formData.name.length,
            email_domain: formData.email.split('@')[1],
            message_length: formData.message.length,
          },
          submission_time_ms: submissionTime,
        },
      });

      trackUserInteraction('successful_form_submission', {
        form: 'contact_form',
        submission_time: submissionTime,
      });

      setSubmitted(true);
      
    } catch (error) {
      const submissionTime = performance.now() - startTime;
      
      // Track submission error
      trackError(error as Error, {
        category: 'form_submission',
        action: 'submission_failed',
        label: 'contact_form',
        metadata: {
          submission_time_ms: submissionTime,
          form_data_lengths: {
            name: formData.name.length,
            email: formData.email.length,
            message: formData.message.length,
          },
        },
      });

      alert('Form submission failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="contact-page">
        <div className="container">
          <div className="success-message">
            <div className="success-icon">✅</div>
            <h1>Thank You!</h1>
            <p>Your message has been submitted successfully. We'll get back to you soon.</p>
            <button 
              className="btn btn-primary"
              onClick={() => {
                setSubmitted(false);
                setFormData({ name: '', email: '', message: '' });
                
                track({
                  category: 'user_interaction',
                  action: 'form_reset',
                  label: 'contact_form',
                });
              }}
            >
              Submit Another Message
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="contact-page">
      <div className="container">
        <h1>Contact Us</h1>
        
        <div className="contact-content">
          <div className="contact-info">
            <h2>Get in Touch</h2>
            <p>
              Have questions about our monitoring solution? We'd love to hear from you.
              This form demonstrates comprehensive form tracking including:
            </p>
            
            <ul className="features-list">
              <li>Form field interaction tracking</li>
              <li>Validation error tracking</li>
              <li>Submission performance monitoring</li>
              <li>Conversion funnel analytics</li>
              <li>Error handling and reporting</li>
            </ul>
          </div>

          <form className="contact-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="name">Name *</label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={handleInputChange('name')}
                placeholder="Enter your full name"
                className="form-control"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">Email *</label>
              <input
                type="email"
                id="email"
                value={formData.email}
                onChange={handleInputChange('email')}
                placeholder="Enter your email address"
                className="form-control"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="message">Message *</label>
              <textarea
                id="message"
                value={formData.message}
                onChange={handleInputChange('message')}
                placeholder="Tell us about your monitoring needs..."
                className="form-control"
                rows={5}
                required
              />
            </div>

            <div className="form-actions">
              <button 
                type="submit" 
                className="btn btn-primary btn-lg"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Submitting...' : 'Send Message'}
              </button>
            </div>
          </form>
        </div>

        <div className="monitoring-note">
          <h3>🔍 What's Being Tracked</h3>
          <div className="tracking-info">
            <div className="tracking-item">
              <strong>Form Interactions:</strong> Field focus, input events, completion rates
            </div>
            <div className="tracking-item">
              <strong>Validation Events:</strong> Field-level validation, error patterns
            </div>
            <div className="tracking-item">
              <strong>Submission Metrics:</strong> Success/failure rates, performance timing
            </div>
            <div className="tracking-item">
              <strong>User Journey:</strong> How users navigate to and from this form
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;