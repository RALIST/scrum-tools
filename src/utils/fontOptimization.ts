/**
 * Font optimization utilities for better loading performance
 * Implements font preloading, display swap, and loading strategies
 */

export interface FontConfig {
  family: string;
  weights?: number[];
  display?: 'auto' | 'block' | 'swap' | 'fallback' | 'optional';
  preload?: boolean;
  subset?: string;
}

/**
 * Generate font preload links for critical fonts
 */
export const generateFontPreloads = (fonts: FontConfig[]): string => {
  return fonts
    .filter(font => font.preload)
    .map(font => {
      const weights = font.weights || [400];
      return weights
        .map(
          weight =>
            `<link rel="preload" href="/fonts/${font.family}-${weight}.woff2" as="font" type="font/woff2" crossorigin>`
        )
        .join('\n');
    })
    .join('\n');
};

/**
 * Generate font-face CSS with optimizations
 */
export const generateFontFaceCSS = (fonts: FontConfig[]): string => {
  return fonts
    .map(font => {
      const weights = font.weights || [400];
      const display = font.display || 'swap';

      return weights
        .map(
          weight => `
@font-face {
  font-family: '${font.family}';
  font-weight: ${weight};
  font-style: normal;
  font-display: ${display};
  src: url('/fonts/${font.family}-${weight}.woff2') format('woff2'),
       url('/fonts/${font.family}-${weight}.woff') format('woff');
}
    `
        )
        .join('\n');
    })
    .join('\n');
};

/**
 * Font loading strategies for different use cases
 */
export const FontLoadingStrategies = {
  /**
   * Critical fonts - load immediately with font-display: swap
   */
  critical: {
    display: 'swap' as const,
    preload: true,
  },

  /**
   * Important fonts - load with fallback
   */
  important: {
    display: 'fallback' as const,
    preload: false,
  },

  /**
   * Optional fonts - load only if network is fast
   */
  optional: {
    display: 'optional' as const,
    preload: false,
  },
};

/**
 * Default font configuration for the application
 */
export const defaultFontConfig: FontConfig[] = [
  {
    family: 'Inter',
    weights: [400, 500, 600, 700],
    ...FontLoadingStrategies.critical,
  },
  {
    family: 'JetBrains Mono',
    weights: [400, 500],
    ...FontLoadingStrategies.important,
  },
];

/**
 * Font loading performance monitoring
 */
export const trackFontLoadingPerformance = () => {
  if ('fonts' in document) {
    const fontLoadPromises = Array.from(document.fonts).map(font => {
      const startTime = performance.now();

      return font
        .load()
        .then(() => {
          const loadTime = performance.now() - startTime;
          console.log(`Font loaded: ${font.family} ${font.weight} in ${loadTime.toFixed(2)}ms`);
          return { font: font.family, weight: font.weight, loadTime };
        })
        .catch(error => {
          console.warn(`Font failed to load: ${font.family} ${font.weight}`, error);
          return null;
        });
    });

    Promise.all(fontLoadPromises).then(results => {
      const successful = results.filter(Boolean);
      console.group('🔤 Font Loading Performance');
      console.log(`Loaded ${successful.length} fonts successfully`);
      successful.forEach(result => {
        if (result) {
          console.log(`  ${result.font} ${result.weight}: ${result.loadTime.toFixed(2)}ms`);
        }
      });
      console.groupEnd();
    });
  }
};

/**
 * Initialize font optimization
 */
export const initFontOptimization = () => {
  // Track font loading performance
  document.addEventListener('DOMContentLoaded', trackFontLoadingPerformance);

  // Add font-display: swap to Google Fonts if used
  const googleFontLinks = document.querySelectorAll('link[href*="fonts.googleapis.com"]');
  googleFontLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href && !href.includes('display=swap')) {
      link.setAttribute('href', href + '&display=swap');
    }
  });
};

export default {
  generateFontPreloads,
  generateFontFaceCSS,
  FontLoadingStrategies,
  defaultFontConfig,
  trackFontLoadingPerformance,
  initFontOptimization,
};
