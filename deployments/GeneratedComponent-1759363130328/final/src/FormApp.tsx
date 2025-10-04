import React, { useState, useCallback } from 'react';

interface FormData {
  name: string;
  email: string;
  message: string;
}

const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  const [loading, setLoading] = React.useState(false);
  const [hasError, setHasError] = React.useState(false);

  React.useEffect(() => {
    const handleError = () => setHasError(true);
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="error-boundary p-4 bg-red-50 border border-red-200 rounded-lg">
        <h3 className="text-red-800 font-semibold">Something went wrong</h3>
        <p className="text-red-600">Please refresh the page to try again.</p>
      </div>
    );
  }

  return <>{children}</>;
};

export default function FormApp() {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('Form submitted:', formData);
    setIsSubmitted(true);
    setIsSubmitting(false);
  }, [formData]);

  const resetForm = useCallback(() => {
    setFormData({ name: '', email: '', message: '' });
    setIsSubmitted(false);
  }, []);

  if (isSubmitted) {
    return (
      <div className="form-container">
        <div className="success-message">
          <h2>Thank you!</h2>
          <p>Your message has been sent successfully.</p>
          <button onClick={resetForm} className="button">
            Send Another Message
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="form-container">
      <h1>Contact Form</h1>

      <form onSubmit={handleSubmit} className="contact-form">
        <div className="form-group">
          <label htmlFor="name">Name *</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            required
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label htmlFor="email">Email *</label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            required
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label htmlFor="message">Message *</label>
          <textarea
            id="message"
            name="message"
            value={formData.message}
            onChange={handleInputChange}
            required
            rows={5}
            className="form-textarea"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="button primary"
        >
          {isSubmitting ? 'Sending...' : 'Send Message'}
        </button>
      </form>
    </div>
  );
}