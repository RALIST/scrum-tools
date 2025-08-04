/**
 * Performance tracking utilities for monitoring app performance
 * Tracks bundle performance, Core Web Vitals, and custom metrics
 */

// Type definitions for Performance API entries
interface LargestContentfulPaintEntry extends PerformanceEntry {
  startTime: number;
  size: number;
}

interface LayoutShiftEntry extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
}

interface FirstInputEntry extends PerformanceEntry {
  processingStart: number;
  startTime: number;
}

export interface PerformanceMetrics {
  firstPaint?: number;
  firstContentfulPaint?: number;
  largestContentfulPaint?: number;
  cumulativeLayoutShift?: number;
  firstInputDelay?: number;
  domContentLoaded?: number;
  windowLoad?: number;
  bundleSize?: {
    main: number;
    chunks: Record<string, number>;
  };
}

/**
 * Track Core Web Vitals and custom performance metrics
 */
export const trackPerformanceMetrics = (): Promise<PerformanceMetrics> => {
  return new Promise(resolve => {
    const metrics: PerformanceMetrics = {};

    // Get navigation timing
    if ('performance' in window) {
      const navigation = performance.getEntriesByType(
        'navigation'
      )[0] as PerformanceNavigationTiming;

      if (navigation) {
        metrics.domContentLoaded =
          navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart;
        metrics.windowLoad = navigation.loadEventEnd - navigation.loadEventStart;
      }

      // Get paint metrics
      const paintEntries = performance.getEntriesByType('paint');
      paintEntries.forEach(entry => {
        if (entry.name === 'first-paint') {
          metrics.firstPaint = entry.startTime;
        } else if (entry.name === 'first-contentful-paint') {
          metrics.firstContentfulPaint = entry.startTime;
        }
      });

      // Get LCP if available
      if ('PerformanceObserver' in window) {
        try {
          const lcpObserver = new PerformanceObserver(list => {
            const entries = list.getEntries() as LargestContentfulPaintEntry[];
            const lastEntry = entries[entries.length - 1];
            if (lastEntry) {
              metrics.largestContentfulPaint = lastEntry.startTime;
            }
          });
          lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

          // Get CLS
          const clsObserver = new PerformanceObserver(list => {
            let clsValue = 0;
            const entries = list.getEntries() as LayoutShiftEntry[];
            for (const entry of entries) {
              if (!entry.hadRecentInput) {
                clsValue += entry.value;
              }
            }
            metrics.cumulativeLayoutShift = clsValue;
          });
          clsObserver.observe({ entryTypes: ['layout-shift'] });

          // Get FID
          const fidObserver = new PerformanceObserver(list => {
            const entries = list.getEntries() as FirstInputEntry[];
            for (const entry of entries) {
              metrics.firstInputDelay = entry.processingStart - entry.startTime;
            }
          });
          fidObserver.observe({ entryTypes: ['first-input'] });
        } catch (e) {
          console.warn('PerformanceObserver not fully supported:', e);
        }
      }
    }

    // Wait a bit for metrics to be collected
    setTimeout(() => resolve(metrics), 1000);
  });
};

/**
 * Log performance metrics to console (and could send to analytics)
 */
export const logPerformanceMetrics = async () => {
  const metrics = await trackPerformanceMetrics();

  console.group('🚀 Performance Metrics');
  console.log(
    'First Paint (FP):',
    metrics.firstPaint ? `${metrics.firstPaint.toFixed(2)}ms` : 'N/A'
  );
  console.log(
    'First Contentful Paint (FCP):',
    metrics.firstContentfulPaint ? `${metrics.firstContentfulPaint.toFixed(2)}ms` : 'N/A'
  );
  console.log(
    'Largest Contentful Paint (LCP):',
    metrics.largestContentfulPaint ? `${metrics.largestContentfulPaint.toFixed(2)}ms` : 'N/A'
  );
  console.log(
    'Cumulative Layout Shift (CLS):',
    metrics.cumulativeLayoutShift ? metrics.cumulativeLayoutShift.toFixed(4) : 'N/A'
  );
  console.log(
    'First Input Delay (FID):',
    metrics.firstInputDelay ? `${metrics.firstInputDelay.toFixed(2)}ms` : 'N/A'
  );
  console.log(
    'DOM Content Loaded:',
    metrics.domContentLoaded ? `${metrics.domContentLoaded.toFixed(2)}ms` : 'N/A'
  );
  console.log('Window Load:', metrics.windowLoad ? `${metrics.windowLoad.toFixed(2)}ms` : 'N/A');
  console.groupEnd();

  return metrics;
};

/**
 * Track bundle performance after Phase 3 optimizations
 */
export const trackBundlePerformance = () => {
  if ('performance' in window) {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const jsResources = resources.filter(
      resource => resource.name.includes('.js') && resource.name.includes('/assets/')
    );

    console.group('📦 Bundle Performance');
    console.log('JavaScript Resources Loaded:', jsResources.length);

    const totalJsSize = jsResources.reduce((total, resource) => {
      const size = resource.encodedBodySize || resource.transferSize || 0;
      return total + size;
    }, 0);

    console.log('Total JS Transfer Size:', `${(totalJsSize / 1024).toFixed(2)} KB`);

    // Log individual chunks
    jsResources.forEach(resource => {
      const size = resource.encodedBodySize || resource.transferSize || 0;
      const filename = resource.name.split('/').pop();
      console.log(`  ${filename}: ${(size / 1024).toFixed(2)} KB`);
    });

    console.groupEnd();

    return {
      totalResources: jsResources.length,
      totalSize: totalJsSize,
      resources: jsResources.map(r => ({
        name: r.name.split('/').pop(),
        size: r.encodedBodySize || r.transferSize || 0,
        loadTime: r.responseEnd - r.startTime,
      })),
    };
  }

  return null;
};

/**
 * Initialize performance tracking on app load
 */
export const initPerformanceTracking = () => {
  // Track metrics after page load
  window.addEventListener('load', () => {
    setTimeout(() => {
      logPerformanceMetrics();
      trackBundlePerformance();
    }, 100);
  });

  // Track route changes (for SPA navigation)
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      console.log('🔄 Route change detected:', url);
      // Could track route-specific performance here
    }
  }).observe(document, { subtree: true, childList: true });
};

export default {
  trackPerformanceMetrics,
  logPerformanceMetrics,
  trackBundlePerformance,
  initPerformanceTracking,
};
