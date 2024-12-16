import React, { useEffect, useRef } from 'react';

const QGroundControl: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    import('novnc-core').then((VNC) => {
      const rfb = new VNC.RFB(canvasRef.current!, 'ws://localhost:5900');
      rfb.scaleViewport = true;
      rfb.viewOnly = true;
    });
  }, []);

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />;
};

export default QGroundControl;
