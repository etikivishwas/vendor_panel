let razorpayScriptPromise;

export const loadRazorpayCheckout = () => {
  if (window.Razorpay) {
    return Promise.resolve(true);
  }

  if (razorpayScriptPromise) {
    return razorpayScriptPromise;
  }

  razorpayScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error("Unable to load Razorpay Checkout."));
    document.body.appendChild(script);
  });

  return razorpayScriptPromise;
};
