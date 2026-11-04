import React from 'react';

export default function App() {
  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', border: '1px solid #ddd', borderRadius: '8px', maxWidth: '400px', margin: '20px auto' }}>
      <h1 style={{ color: '#333', fontSize: '1.5rem', marginBottom: '10px' }}>Gnatbot is ready!</h1>
      <p style={{ color: '#555', lineHeight: '1.6' }}>
        This is your basic React component, created automatically to help structure your project.
        It serves as the main entry point for your application's user interface.
      </p>
      <button style={{ backgroundColor: '#2da44e', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '6px', fontSize: '1rem', cursor: 'pointer', marginTop: '15px' }}>
        Learn More
      </button>
    </div>
  );
}
