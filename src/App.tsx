import React, { useState, useRef, useCallback } from 'react';
import * as pdfjs from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { 
  Upload, 
  FileText, 
  Download, 
  Trash2, 
  Loader2, 
  CheckCircle2,
  AlertCircle,
  Moon,
  Sun,
  RefreshCcw
} from 'lucide-react';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
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
      setDownloadUrl(null);
    } else if (selectedFile) {
      setError('PDF only, please.');
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && droppedFile.type === 'application/pdf') {
      setFile(droppedFile);
      setError(null);
      setDownloadUrl(null);
    } else if (droppedFile) {
      setError('PDF only, please.');
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
      
      if (numPages > 1000) {
        throw new Error('Too many pages (max 1000).');
      }

      let totalHeight = 0;
      let maxWidth = 0;
      const MAX_CANVAS_HEIGHT = 32767; 
      const MAX_CANVAS_WIDTH = 8192;
      
      let currentScale = numPages > 100 ? 0.8 : (numPages > 50 ? 1.0 : 1.5); 

      // First pass: calculate total height
      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: currentScale });
        totalHeight += viewport.height;
        maxWidth = Math.max(maxWidth, viewport.width);
      }

      if (totalHeight > MAX_CANVAS_HEIGHT || maxWidth > MAX_CANVAS_WIDTH) {
        const heightScale = MAX_CANVAS_HEIGHT / totalHeight;
        const widthScale = MAX_CANVAS_WIDTH / maxWidth;
        const adjustmentFactor = Math.min(heightScale, widthScale);
        currentScale = currentScale * adjustmentFactor;
        
        totalHeight = 0;
        maxWidth = 0;
        for (let i = 1; i <= numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: currentScale });
          totalHeight += viewport.height;
          maxWidth = Math.max(maxWidth, viewport.width);
        }
      }

      const longCanvas = document.createElement('canvas');
      longCanvas.width = Math.floor(maxWidth);
      longCanvas.height = Math.floor(totalHeight);
      const longCtx = longCanvas.getContext('2d');
      if (!longCtx) throw new Error('Memory limit. Try a smaller PDF.');

      longCtx.fillStyle = '#ffffff';
      longCtx.fillRect(0, 0, longCanvas.width, longCanvas.height);

      let currentY = 0;
      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: currentScale });
        
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) throw new Error('Canvas error at page ' + i);

        tempCanvas.height = viewport.height;
        tempCanvas.width = viewport.width;

        await page.render({ canvasContext: tempCtx, viewport, canvas: tempCanvas }).promise;
        
        const xOffset = (longCanvas.width - tempCanvas.width) / 2;
        longCtx.drawImage(tempCanvas, xOffset, currentY);
        currentY += tempCanvas.height;

        tempCanvas.width = 0;
        tempCanvas.height = 0;
        
        setProgress(Math.round((i / numPages) * 95));
      }

      try {
        const blob = await new Promise<Blob | null>((resolve) => {
          longCanvas.toBlob((b) => resolve(b), 'image/png');
        });

        if (!blob) throw new Error('Blob failed.');
        
        const url = URL.createObjectURL(blob);
        setDownloadUrl(url);
        setProgress(100);
      } catch (e) {
        throw new Error('Image too big for browser.');
      } finally {
        longCanvas.width = 0;
        longCanvas.height = 0;
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadImage = () => {
    if (!downloadUrl) return;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `${file?.name.replace('.pdf', '') || 'pdf-long-image'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const reset = () => {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    setFile(null);
    setDownloadUrl(null);
    setError(null);
    setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className={`min-h-screen font-mono ${isDarkMode ? 'dark bg-black text-white' : 'bg-white text-black'}`}>
      {/* Simple Header */}
      <header className="border-b border-current p-4 flex justify-between items-center">
        <div className="flex items-center gap-2 font-bold text-xl">
          <FileText size={24} />
          <span>PDF2LONG.EXE</span>
        </div>
        <button onClick={toggleDarkMode} className="p-2 border border-current hover:bg-current hover:text-white dark:hover:text-black transition-colors">
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </header>

      <main className="max-w-2xl mx-auto p-8">
        <div className="mb-12">
          <h2 className="text-3xl font-black mb-2 uppercase tracking-tighter">PDF to Long Image</h2>
          <p className="opacity-60 text-sm">Convert your PDF into one long PNG. No rendering in browser = no crashes. Fast & local.</p>
        </div>

        <div className="space-y-8">
          {!file && !downloadUrl && (
            <div 
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-4 border-dashed border-current p-16 text-center cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
            >
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".pdf" className="hidden" />
              <Upload size={48} className="mx-auto mb-4" />
              <p className="font-bold text-lg">DROP PDF OR CLICK</p>
              <p className="text-xs opacity-50 mt-2">Up to 1000 pages supported</p>
            </div>
          )}

          {file && !downloadUrl && (
            <div className="border-2 border-current p-6">
              <div className="flex justify-between items-start mb-6">
                <div className="flex gap-3">
                  <FileText size={32} />
                  <div>
                    <p className="font-bold break-all">{file.name}</p>
                    <p className="text-xs opacity-60">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                {!isProcessing && (
                  <button onClick={reset} className="p-1 hover:bg-red-500 hover:text-white transition-colors">
                    <Trash2 size={20} />
                  </button>
                )}
              </div>

              {isProcessing ? (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold uppercase">
                    <span className="flex items-center gap-2">
                      <Loader2 size={14} className="animate-spin" />
                      Processing...
                    </span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-4 border border-current p-0.5">
                    <div 
                      className="h-full bg-current transition-all duration-300" 
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              ) : (
                <button
                  onClick={processPdf}
                  className="w-full py-4 border-2 border-current font-bold text-xl hover:bg-current hover:text-white dark:hover:text-black transition-colors uppercase"
                >
                  Start Conversion
                </button>
              )}
            </div>
          )}

          {downloadUrl && (
            <div className="border-2 border-current p-6 bg-zinc-50 dark:bg-zinc-900">
              <div className="flex items-center gap-3 text-green-600 dark:text-green-400 font-bold mb-6">
                <CheckCircle2 size={24} />
                <span>CONVERSION COMPLETE</span>
              </div>
              
              <div className="space-y-4">
                <button
                  onClick={downloadImage}
                  className="w-full py-6 bg-black dark:bg-white text-white dark:text-black font-black text-2xl hover:opacity-80 transition-opacity flex items-center justify-center gap-4 uppercase"
                >
                  <Download size={28} />
                  Download PNG
                </button>
                
                <button
                  onClick={reset}
                  className="w-full py-3 border border-current font-bold hover:bg-current hover:text-white dark:hover:text-black transition-colors flex items-center justify-center gap-2 uppercase text-sm"
                >
                  <RefreshCcw size={16} />
                  Convert Another
                </button>
              </div>
              
              <p className="mt-6 text-[10px] opacity-40 text-center uppercase tracking-widest">
                Image is ready. No preview shown to save your browser's life.
              </p>
            </div>
          )}

          {error && (
            <div className="p-4 border-2 border-red-500 text-red-500 flex items-center gap-3 font-bold uppercase text-sm">
              <AlertCircle size={20} />
              <span>Error: {error}</span>
            </div>
          )}
        </div>
      </main>

      <footer className="max-w-2xl mx-auto p-8 opacity-30 text-[10px] text-center uppercase tracking-[0.2em]">
        PDF2LONG • NO AI • NO CLOUD • JUST JAVASCRIPT
      </footer>
    </div>
  );
}
