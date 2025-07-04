export const isSafari = () => {
  if (typeof window === 'undefined') return false;
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
};

export const safariOptimizations = {
  imageLoadingDelay: isSafari() ? 100 : 0,
  reducedAnimations: isSafari(),
  prefersReducedData: isSafari()
};