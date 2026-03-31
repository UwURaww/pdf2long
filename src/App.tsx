import React, { useState, useRef, useCallback } from 'react';
import * as pdfjs from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, 
  FileText, 
  Download, 
  Trash2, 
  Loader2, 
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Moon,
  Sun
} from 'lucide-react';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setError(null);
      setResultImage(null);
    } else if (selectedFile) {
      setError('Please upload a valid PDF file.');
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && droppedFile.type === 'application/pdf') {
      setFile(droppedFile);
      setError(null);
      setResultImage(null);
    } else if (droppedFile) {
      setError('Please upload a valid PDF file.');
    }
  }, []);

  const processPdf = async () => {
    if (!file) return;

    setIsProcessing(true);
    setProgress(0);
    setError(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdf.numPages;
      
      // Limit pages to prevent browser crash
      if (numPages > 100) {
        throw new Error('PDF is too long. Maximum 100 pages allowed.');
      }

      const canvases: HTMLCanvasElement[] = [];
      let totalHeight = 0;
      let maxWidth = 0;
      const MAX_CANVAS_HEIGHT = 30000; // Safe limit for most browsers
      let currentScale = 2; // Initial high quality scale

      // First pass: calculate total height at scale 2
      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: currentScale });
        totalHeight += viewport.height;
        maxWidth = Math.max(maxWidth, viewport.width);
      }

      // Adjust scale if total height exceeds limit
      if (totalHeight > MAX_CANVAS_HEIGHT) {
        currentScale = (MAX_CANVAS_HEIGHT / totalHeight) * currentScale;
        // Recalculate dimensions with new scale
        totalHeight = 0;
        maxWidth = 0;
        for (let i = 1; i <= numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: currentScale });
          totalHeight += viewport.height;
          maxWidth = Math.max(maxWidth, viewport.width);
        }
      }

      // Second pass: render pages
      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: currentScale });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Could not get canvas context');

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport, canvas }).promise;
        
        canvases.push(canvas);
        setProgress(Math.round((i / numPages) * 100));
      }

      // Create the long canvas
      const longCanvas = document.createElement('canvas');
      longCanvas.width = maxWidth;
      longCanvas.height = totalHeight;
      const longCtx = longCanvas.getContext('2d');
      if (!longCtx) throw new Error('Could not get long canvas context. The image might be too large for your browser.');

      // Fill background with white
      longCtx.fillStyle = '#ffffff';
      longCtx.fillRect(0, 0, maxWidth, totalHeight);

      let currentY = 0;
      for (const canvas of canvases) {
        const xOffset = (maxWidth - canvas.width) / 2;
        longCtx.drawImage(canvas, xOffset, currentY);
        currentY += canvas.height;
        // Clean up intermediate canvas to free memory
        canvas.width = 0;
        canvas.height = 0;
      }

      try {
        const imageUrl = longCanvas.toDataURL('image/png');
        setResultImage(imageUrl);
      } catch (e) {
        throw new Error('Failed to generate image. The result might be too large for your browser memory.');
      } finally {
        // Clean up long canvas
        longCanvas.width = 0;
        longCanvas.height = 0;
      }
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Failed to process PDF. Please try again.';
      setError(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadImage = () => {
    if (!resultImage) return;
    const link = document.createElement('a');
    link.href = resultImage;
    link.download = `${file?.name.replace('.pdf', '') || 'long-image'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const reset = () => {
    setFile(null);
    setResultImage(null);
    setError(null);
    setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDarkMode ? 'dark bg-zinc-950 text-zinc-100' : 'bg-zinc-50 text-zinc-900'}`}>
      {/* Header */}
      <header className="fixed top-0 w-full z-50 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/70">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center text-white">
              <FileText size={20} />
            </div>
            <h1 className="font-bold text-lg tracking-tight">PDF2Long</h1>
          </div>
          <button 
            onClick={toggleDarkMode}
            className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 pt-32 pb-20">
        <div className="text-center mb-12">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-extrabold mb-4 tracking-tight"
          >
            Convert PDF to <span className="text-orange-500">Long Image</span>
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-zinc-500 dark:text-zinc-400 text-lg"
          >
            Stitch all pages of your PDF into one continuous image. Perfect for social media and quick viewing.
          </motion.p>
        </div>

        <AnimatePresence mode="wait">
          {!file && !resultImage && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              className="relative group"
            >
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".pdf"
                className="hidden"
              />
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-3xl p-12 flex flex-col items-center justify-center gap-4 transition-all hover:border-orange-500 dark:hover:border-orange-500 hover:bg-orange-50/50 dark:hover:bg-orange-950/10"
              >
                <div className="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-orange-500 group-hover:bg-orange-100 dark:group-hover:bg-orange-900/30 transition-colors">
                  <Upload size={32} />
                </div>
                <div className="text-center">
                  <p className="text-xl font-semibold">Drop your PDF here</p>
                  <p className="text-zinc-500 dark:text-zinc-400">or click to browse files</p>
                </div>
              </div>
              {error && (
                <div className="mt-4 flex items-center gap-2 text-red-500 justify-center">
                  <AlertCircle size={16} />
                  <span className="text-sm">{error}</span>
                </div>
              )}
            </motion.div>
          )}

          {file && !resultImage && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-xl shadow-zinc-200/50 dark:shadow-none"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 text-orange-500 rounded-xl flex items-center justify-center">
                    <FileText size={24} />
                  </div>
                  <div>
                    <p className="font-bold text-lg truncate max-w-[200px]">{file.name}</p>
                    <p className="text-sm text-zinc-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                {!isProcessing && (
                  <button 
                    onClick={reset}
                    className="p-2 text-zinc-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={20} />
                  </button>
                )}
              </div>

              {isProcessing ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm font-medium">
                    <span className="flex items-center gap-2">
                      <Loader2 size={16} className="animate-spin text-orange-500" />
                      Rendering pages...
                    </span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-orange-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              ) : (
                <button
                  onClick={processPdf}
                  className="w-full py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-bold text-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                  <ImageIcon size={20} />
                  Convert to Long Image
                </button>
              )}
            </motion.div>
          )}

          {resultImage && (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-4 shadow-xl overflow-hidden">
                <div className="flex items-center justify-between mb-4 px-4 pt-2">
                  <div className="flex items-center gap-2 text-green-500 font-semibold">
                    <CheckCircle2 size={20} />
                    Ready to download
                  </div>
                  <button 
                    onClick={reset}
                    className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 font-medium"
                  >
                    Start Over
                  </button>
                </div>
                
                <div className="relative group rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 max-h-[500px] overflow-y-auto custom-scrollbar">
                  <img 
                    src={resultImage} 
                    alt="Result" 
                    className="w-full h-auto"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                    <p className="text-white font-medium bg-black/50 px-4 py-2 rounded-full backdrop-blur-sm">
                      Previewing long image
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={downloadImage}
                  className="flex-1 py-4 bg-orange-500 text-white rounded-2xl font-bold text-lg hover:bg-orange-600 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20"
                >
                  <Download size={20} />
                  Download Image
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="max-w-3xl mx-auto px-4 py-8 border-t border-zinc-200 dark:border-zinc-800 text-center text-zinc-500 text-sm">
        <p>© 2026 PDF2Long • Simple & Secure Browser-based Conversion</p>
      </footer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0,0,0,0.1);
          border-radius: 10px;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
        }
      `}</style>
    </div>
  );
}
