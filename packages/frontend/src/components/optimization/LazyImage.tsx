/**
 * Optimized lazy loading image component
 */

import React, { memo, useState, useCallback } from 'react';
import { useImageLazyLoading } from '@/hooks/usePerformance';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  placeholder?: string;
  fallback?: string;
  onLoad?: () => void;
  onError?: () => void;
  sizes?: string;
  priority?: boolean;
}

const LazyImage = memo<LazyImageProps>(({
  src,
  alt,
  className = '',
  placeholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjZjNmNGY2Ii8+CjxwYXRoIGQ9Ik0xMiA5QzEwLjM0IDkgOSAxMC4zNCA5IDEyUzEwLjM0IDE1IDEyIDE1IDE1IDEzLjY2IDE1IDEyIDEzLjY2IDkgMTIgOVpNMTIgMTNDMTEuNDUgMTMgMTEgMTIuNTUgMTEgMTJDMTEgMTEuNDUgMTEuNDUgMTEgMTIgMTFDMTIuNTUgMTEgMTMgMTEuNDUgMTMgMTJDMTMgMTIuNTUgMTIuNTUgMTMgMTIgMTNaIiBmaWxsPSIjOWNhM2FmIi8+Cjwvc3ZnPgo=',
  fallback,
  onLoad,
  onError,
  sizes,
  priority = false,
}) => {
  const { ref, loaded, error, shouldLoad, loadImage } = useImageLazyLoading();
  const [imageSrc, setImageSrc] = useState(priority ? src : placeholder);

  React.useEffect(() => {
    if (priority) {
      setImageSrc(src);
      return;
    }

    if (shouldLoad && !loaded && !error) {
      loadImage(src);
    }

    if (loaded) {
      setImageSrc(src);
    } else if (error && fallback) {
      setImageSrc(fallback);
    }
  }, [src, shouldLoad, loaded, error, loadImage, fallback, priority]);

  const handleLoad = useCallback(() => {
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback(() => {
    if (fallback) {
      setImageSrc(fallback);
    }
    onError?.();
  }, [fallback, onError]);

  return (
    <div ref={ref} className={`relative overflow-hidden ${className}`}>
      <img
        src={imageSrc}
        alt={alt}
        className="w-full h-full object-cover transition-opacity duration-300"
        style={{
          opacity: loaded || priority ? 1 : 0.7,
        }}
        onLoad={handleLoad}
        onError={handleError}
        sizes={sizes}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
      />
      
      {!loaded && !priority && (
        <div className="absolute inset-0 bg-gray-100 animate-pulse flex items-center justify-center">
          <div className="w-8 h-8 text-gray-400">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-full h-full"
            >
              <rect width="24" height="24" fill="#f3f4f6"/>
              <path
                d="M12 9C10.34 9 9 10.34 9 12S10.34 15 12 15 15 13.66 15 12 13.66 9 12 9ZM12 13C11.45 13 11 12.55 11 12C11 11.45 11.45 11 12 11C12.55 11 13 11.45 13 12C13 12.55 12.55 13 12 13Z"
                fill="#9ca3af"
              />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
});

LazyImage.displayName = 'LazyImage';

export default LazyImage;