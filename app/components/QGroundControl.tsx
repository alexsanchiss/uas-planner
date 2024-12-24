import React, { useEffect, useRef } from 'react';

const QGroundControl: React.FC = () => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    // Asegúrate de que noVNC esté corriendo en localhost:6080
    if (iframeRef.current) {
      iframeRef.current.src = 'http://localhost:6080/';
    }
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', border: 'none' }}>
      <iframe
        ref={iframeRef}
        style={{ width: '100%', height: '100%', border: 'none' }}
        title="QGroundControl VNC"
      />
    </div>
  );
};

export default QGroundControl;
