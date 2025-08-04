import { FC, useState } from 'react';
import { Box, Image, Skeleton } from '@chakra-ui/react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number | string;
  height?: number | string;
  sizes?: string;
  priority?: boolean;
  className?: string;
  fallback?: string;
}

/**
 * OptimizedImage component with responsive loading and modern format support
 * Provides WebP/AVIF with fallbacks, lazy loading, and proper aspect ratios
 */
export const OptimizedImage: FC<OptimizedImageProps> = ({
  src,
  alt,
  width,
  height,
  sizes = '100vw',
  priority = false,
  className,
  fallback,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Generate responsive image URLs (would integrate with build process)
  const getResponsiveImageUrls = (baseSrc: string) => {
    const ext = baseSrc.split('.').pop();
    const nameWithoutExt = baseSrc.replace(`.${ext}`, '');

    return {
      webp: `${nameWithoutExt}.webp`,
      avif: `${nameWithoutExt}.avif`,
      original: baseSrc,
    };
  };

  const imageUrls = getResponsiveImageUrls(src);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    setHasError(true);
    setIsLoaded(true);
  };

  if (hasError && fallback) {
    return (
      <Image
        src={fallback}
        alt={alt}
        width={width}
        height={height}
        className={className}
        onLoad={handleLoad}
      />
    );
  }

  return (
    <Box position="relative" width={width} height={height}>
      {!isLoaded && (
        <Skeleton
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          width="100%"
          height="100%"
        />
      )}

      <picture>
        {/* Modern formats with fallbacks */}
        <source srcSet={imageUrls.avif} type="image/avif" sizes={sizes} />
        <source srcSet={imageUrls.webp} type="image/webp" sizes={sizes} />

        <Image
          src={imageUrls.original}
          alt={alt}
          width={width}
          height={height}
          className={className}
          loading={priority ? 'eager' : 'lazy'}
          onLoad={handleLoad}
          onError={handleError}
          opacity={isLoaded ? 1 : 0}
          transition="opacity 0.3s ease-in-out"
        />
      </picture>
    </Box>
  );
};

export default OptimizedImage;
