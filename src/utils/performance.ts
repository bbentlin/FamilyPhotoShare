export const measureRenderTime = (componentName: string) => {
  if (typeof window === 'undefined') return () => {};

  const start = performance.now();

  return () => {
    const end = performance.now();
    console.log(`${componentName} render time: ${(end - start).toFixed(2)}ms`);
  };
};

export const measurePhotoGridPerformance = (photoCount: number) => {
  if (typeof window === 'undefined') return () => {};

  const start = performance.now();

  return () => {
    const end = performance.now();
    const timePerPhoto = (end - start) / photoCount;
    console.log(`Photo grid (${photoCount} photos): ${(end - start).toFixed(2)}ms (${timePerPhoto.toFixed(2)}ms per photo)`);
  };
};