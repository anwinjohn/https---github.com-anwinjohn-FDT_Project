import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera,
  ScanFace,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  Shield,
  Eye,
  Zap,
  ArrowLeft,
} from 'lucide-react';

interface FaceIdLoginProps {
  onSuccess: () => void;
  onBack: () => void;
  username: string;
}

type ScanStep =
  | 'camera-access'
  | 'positioning'
  | 'scanning'
  | 'processing'
  | 'success'
  | 'error';

interface ScanResult {
  success: boolean;
  confidence?: number;
  message?: string;
  error?: string;
}

const FaceIdLogin: React.FC<FaceIdLoginProps> = ({
  onSuccess,
  onBack,
  username,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [currentStep, setCurrentStep] = useState<ScanStep>('camera-access');
  const [scanProgress, setScanProgress] = useState(0);
  const [faceDetected, setFaceDetected] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  // Initialize camera
  const initializeCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      setCurrentStep('positioning');
    } catch (error) {
      console.error('Camera access denied:', error);
      setCurrentStep('error');
      setScanResult({
        success: false,
        error: 'Camera access is required for Face ID authentication',
      });
    }
  }, []);

  // Cleanup camera
  const cleanupCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Simulate face detection (in real app, you'd use a face detection library)
  const detectFace = useCallback(() => {
    // Simulate face detection with random success
    const detected = Math.random() > 0.3;
    setFaceDetected(detected);
    return detected;
  }, []);

  // Capture and process face
  const captureFace = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    // Set canvas dimensions
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current video frame to canvas
    ctx.drawImage(video, 0, 0);

    // Convert to blob
    canvas.toBlob(
      async (blob) => {
        if (!blob) return;

        setIsProcessing(true);
        setCurrentStep('processing');

        try {
          // Create FormData for API call
          const formData = new FormData();
          formData.append('image', blob, 'face-capture.jpg');
          formData.append('username', username);

          // Simulate API call (replace with your actual API endpoint)
          const response = await fetch('/api/face-verification', {
            method: 'POST',
            body: formData,
          });

          // Simulate processing delay
          await new Promise((resolve) => setTimeout(resolve, 2000));

          if (response.ok) {
            const result = await response.json();
            setScanResult({
              success: result.verified,
              confidence: result.confidence,
              message: result.message,
            });

            if (result.verified) {
              setCurrentStep('success');
              setTimeout(() => {
                onSuccess();
              }, 2000);
            } else {
              setCurrentStep('error');
            }
          } else {
            throw new Error('Verification failed');
          }
        } catch (error) {
          console.error('Face verification error:', error);
          setScanResult({
            success: false,
            error: 'Face verification failed. Please try again.',
          });
          setCurrentStep('error');
        } finally {
          setIsProcessing(false);
        }
      },
      'image/jpeg',
      0.8
    );
  }, [username, onSuccess]);

  // Start scanning process
  const startScanning = useCallback(() => {
    setCurrentStep('scanning');
    setScanProgress(0);

    const scanInterval = setInterval(() => {
      setScanProgress((prev) => {
        const newProgress = prev + 2;

        // Simulate face detection during scan
        if (newProgress % 20 === 0) {
          detectFace();
        }

        if (newProgress >= 100) {
          clearInterval(scanInterval);
          captureFace();
          return 100;
        }

        return newProgress;
      });
    }, 50);

    return () => clearInterval(scanInterval);
  }, [detectFace, captureFace]);

  // Retry scanning
  const retryScanning = useCallback(() => {
    setRetryCount((prev) => prev + 1);
    setScanResult(null);
    setScanProgress(0);
    setCurrentStep('positioning');
  }, []);

  // Initialize camera on mount
  useEffect(() => {
    initializeCamera();
    return cleanupCamera;
  }, [initializeCamera, cleanupCamera]);

  // Face detection loop
  useEffect(() => {
    if (currentStep === 'positioning') {
      const detectionInterval = setInterval(detectFace, 500);
      return () => clearInterval(detectionInterval);
    }
  }, [currentStep, detectFace]);

  const stepConfig = {
    'camera-access': {
      title: 'Initializing Camera',
      subtitle: 'Please allow camera access',
      icon: Camera,
      color: 'blue',
    },
    positioning: {
      title: 'Position Your Face',
      subtitle: 'Center your face in the frame',
      icon: ScanFace,
      color: 'blue',
    },
    scanning: {
      title: 'Scanning Face',
      subtitle: 'Hold still while we scan',
      icon: Eye,
      color: 'purple',
    },
    processing: {
      title: 'Verifying Identity',
      subtitle: 'Processing your biometric data',
      icon: Zap,
      color: 'orange',
    },
    success: {
      title: 'Authentication Successful',
      subtitle: 'Welcome back!',
      icon: CheckCircle,
      color: 'green',
    },
    error: {
      title: 'Authentication Failed',
      subtitle: scanResult?.error || 'Please try again',
      icon: XCircle,
      color: 'red',
    },
  };

  const currentConfig = stepConfig[currentStep];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-blue-500/10 to-transparent rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-purple-500/10 to-transparent rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <div className="relative w-full max-w-md mx-auto z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <motion.button
              onClick={onBack}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="p-2 bg-white/10 rounded-xl text-white/70 hover:text-white hover:bg-white/20 transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </motion.button>
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-blue-400" />
              <span className="text-white font-semibold">Face ID</span>
            </div>
            <div className="w-9 h-9" /> {/* Spacer */}
          </div>

          {/* Status Icon */}
          <div className="text-center mb-6">
            <motion.div
              key={currentStep}
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center shadow-2xl ${
                currentConfig.color === 'blue'
                  ? 'bg-gradient-to-br from-blue-500 to-blue-600'
                  : currentConfig.color === 'purple'
                  ? 'bg-gradient-to-br from-purple-500 to-purple-600'
                  : currentConfig.color === 'orange'
                  ? 'bg-gradient-to-br from-orange-500 to-orange-600'
                  : currentConfig.color === 'green'
                  ? 'bg-gradient-to-br from-green-500 to-green-600'
                  : 'bg-gradient-to-br from-red-500 to-red-600'
              }`}
            >
              {currentStep === 'processing' ? (
                <Loader2 className="w-8 h-8 text-white animate-spin" />
              ) : (
                <currentConfig.icon className="w-8 h-8 text-white" />
              )}
            </motion.div>

            <motion.h2
              key={currentConfig.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-2xl font-bold text-white mb-2"
            >
              {currentConfig.title}
            </motion.h2>

            <motion.p
              key={currentConfig.subtitle}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-white/70"
            >
              {currentConfig.subtitle}
            </motion.p>
          </div>

          {/* Camera View */}
          <AnimatePresence mode="wait">
            {(currentStep === 'positioning' || currentStep === 'scanning') && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="relative mb-6"
              >
                <div className="relative w-full aspect-square bg-black/20 rounded-2xl overflow-hidden border-2 border-white/20">
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    autoPlay
                    muted
                    playsInline
                  />

                  {/* Face Detection Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <motion.div
                      animate={{
                        scale: faceDetected ? 1 : 1.1,
                        opacity: faceDetected ? 0.8 : 0.4,
                      }}
                      transition={{ duration: 0.3 }}
                      className={`w-48 h-48 border-4 rounded-full ${
                        faceDetected ? 'border-green-400' : 'border-white/40'
                      }`}
                      style={{
                        background:
                          currentStep === 'scanning'
                            ? `conic-gradient(from 0deg, transparent ${
                                360 - scanProgress * 3.6
                              }deg, rgba(59, 130, 246, 0.5) ${
                                360 - scanProgress * 3.6
                              }deg)`
                            : 'transparent',
                      }}
                    >
                      {/* Corner guides */}
                      <div className="absolute -top-1 -left-1 w-8 h-8 border-l-4 border-t-4 border-white rounded-tl-lg"></div>
                      <div className="absolute -top-1 -right-1 w-8 h-8 border-r-4 border-t-4 border-white rounded-tr-lg"></div>
                      <div className="absolute -bottom-1 -left-1 w-8 h-8 border-l-4 border-b-4 border-white rounded-bl-lg"></div>
                      <div className="absolute -bottom-1 -right-1 w-8 h-8 border-r-4 border-b-4 border-white rounded-br-lg"></div>
                    </motion.div>
                  </div>

                  {/* Scanning Animation */}
                  {currentStep === 'scanning' && (
                    <motion.div
                      initial={{ y: -100 }}
                      animate={{ y: 300 }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: 'linear',
                      }}
                      className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent opacity-80"
                    />
                  )}
                </div>

                {/* Face Detection Status */}
                <div className="flex items-center justify-center mt-4 gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      faceDetected ? 'bg-green-400' : 'bg-red-400'
                    }`}
                  />
                  <span className="text-white/70 text-sm">
                    {faceDetected
                      ? 'Face detected'
                      : 'Position your face in the circle'}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Progress Bar */}
          {currentStep === 'scanning' && (
            <div className="mb-6">
              <div className="flex justify-between text-sm text-white/70 mb-2">
                <span>Scanning Progress</span>
                <span>{Math.round(scanProgress)}%</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${scanProgress}%` }}
                  className="h-full bg-gradient-to-r from-blue-400 to-purple-400 rounded-full"
                />
              </div>
            </div>
          )}

          {/* Processing Animation */}
          {currentStep === 'processing' && (
            <div className="mb-6 text-center">
              <div className="flex justify-center space-x-1 mb-4">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [0.5, 1, 0.5],
                    }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      delay: i * 0.2,
                    }}
                    className="w-2 h-2 bg-blue-400 rounded-full"
                  />
                ))}
              </div>
              <p className="text-white/60 text-sm">
                Analyzing biometric patterns...
              </p>
            </div>
          )}

          {/* Success/Error Results */}
          {(currentStep === 'success' || currentStep === 'error') &&
            scanResult && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 text-center"
              >
                {scanResult.confidence && (
                  <div className="mb-4">
                    <div className="text-white/70 text-sm mb-2">
                      Confidence Score
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {Math.round(scanResult.confidence * 100)}%
                    </div>
                  </div>
                )}

                {scanResult.message && (
                  <p className="text-white/80 text-sm">{scanResult.message}</p>
                )}
              </motion.div>
            )}

          {/* Action Buttons */}
          <div className="space-y-3">
            {currentStep === 'positioning' && (
              <motion.button
                onClick={startScanning}
                disabled={!faceDetected}
                whileHover={{ scale: faceDetected ? 1.02 : 1 }}
                whileTap={{ scale: faceDetected ? 0.98 : 1 }}
                className={`w-full flex items-center justify-center gap-2 px-6 py-3 font-semibold rounded-xl transition-all duration-200 shadow-lg ${
                  faceDetected
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white hover:shadow-xl'
                    : 'bg-white/10 text-white/50 cursor-not-allowed'
                }`}
              >
                <ScanFace className="w-5 h-5" />
                Start Face Scan
              </motion.button>
            )}

            {currentStep === 'error' && (
              <motion.button
                onClick={retryScanning}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                <RefreshCw className="w-5 h-5" />
                Try Again {retryCount > 0 && `(${retryCount + 1})`}
              </motion.button>
            )}
          </div>

          {/* Tips */}
          {currentStep === 'positioning' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-6 p-4 bg-white/5 rounded-xl border border-white/10"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-white/70">
                  <p className="font-medium text-white/90 mb-1">
                    Tips for best results:
                  </p>
                  <ul className="space-y-1 text-xs">
                    <li>• Ensure good lighting on your face</li>
                    <li>• Remove glasses or masks if possible</li>
                    <li>• Keep your face centered in the circle</li>
                    <li>• Stay still during the scan</li>
                  </ul>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Hidden canvas for image capture */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
};

export default FaceIdLogin;
