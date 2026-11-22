'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { ImageOff } from 'lucide-react';

export interface ImageWithFallbackProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackSrc?: string;
  fallbackText?: string;
  fallbackTone?: 'neutral' | 'info';
  optimized?: boolean;
  fill?: boolean;
  sizes?: string;
}

export default function ImageWithFallback({
  src,
  alt = '',
  fallbackSrc,
  fallbackText = 'Image not available',
  fallbackTone = 'neutral',
  optimized = false,
  fill = false,
  sizes,
  width,
  height,
  className = '',
  style = {},
  onLoad,
  onError,
  ...props
}: ImageWithFallbackProps) {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const handleLoad = (event: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setLoading(false);
    onLoad?.(event);
  };

  const handleError = (event: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setError(true);
    setLoading(false);
    onError?.(event);
  };

  const optimizedWidth = typeof width === 'number' ? width : width ? Number(width) : undefined;
  const optimizedHeight = typeof height === 'number' ? height : height ? Number(height) : undefined;

  if (error || !src || typeof src !== 'string') {
    if (fallbackSrc) {
      return (
        <img
          src={fallbackSrc}
          alt={alt}
          className={className}
          style={style}
          {...props}
        />
      );
    }

    const info = fallbackTone === 'info';
    return (
      <div
        role="img"
        aria-label={alt || fallbackText}
        className={className}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          backgroundColor: info ? 'var(--tuw-bg-info, #F4F9FE)' : 'var(--tuw-bg-surface-subtle, #F1F3F5)',
          color: info ? 'var(--tuw-text-info, #175CD3)' : 'var(--tuw-text-tertiary, #9CA3AF)',
          borderRadius: 'var(--tuw-radius-control, 8px)',
          border: '1px dashed var(--tuw-border-subtle, #E5E7EB)',
          padding: '16px',
          width: '100%',
          height: '100%',
          minHeight: '120px',
          boxSizing: 'border-box',
          ...style,
        }}
      >
        <ImageOff size={24} />
        <span style={{ fontSize: '12px', textAlign: 'center', fontWeight: 500, color: info ? 'var(--tuw-text-error, #C91818)' : undefined }}>
          {fallbackText}
        </span>
      </div>
    );
  }

  const imageStyle: React.CSSProperties = {
    transition: 'opacity 0.2s ease',
    opacity: loading ? 0.7 : 1,
    ...style,
  };

  if (optimized && fill) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        unoptimized
        onLoad={handleLoad}
        onError={handleError}
        className={className}
        style={imageStyle}
        {...props}
      />
    );
  }

  if (
    optimized &&
    optimizedWidth !== undefined &&
    optimizedHeight !== undefined &&
    Number.isFinite(optimizedWidth) &&
    Number.isFinite(optimizedHeight)
  ) {
    return (
      <Image
        src={src}
        alt={alt}
        width={optimizedWidth}
        height={optimizedHeight}
        sizes={sizes}
        unoptimized
        onLoad={handleLoad}
        onError={handleError}
        className={className}
        style={imageStyle}
        {...props}
      />
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      onLoad={handleLoad}
      onError={handleError}
      className={className}
      style={imageStyle}
      {...props}
    />
  );
}
