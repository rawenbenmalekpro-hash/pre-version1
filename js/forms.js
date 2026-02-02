/* js/forms.js — Universal Form Handler */

// STAGING CONFIGURATION
// Replace with your actual OVH VPS IP until domain is ready
const API_CONFIG = {
  baseUrl: 'http://<YOUR_OVH_IP>:8090', 
  collections: {
    prague: 'prague_registrations',
    epcc: 'epcc_registrations'
  }
};

async function submitForm(event, type) {
  event.preventDefault();
  const form = event.target;
  const btn = form.querySelector('button[type="submit"]');
  const msg = form.querySelector('.form-message');
  
  // 1. Lock UI
  const originalText = btn.innerText;
  btn.innerText = 'Sending...';
  btn.disabled = true;
  msg.hidden = true;
  msg.className = 'form-message'; // reset

  // 2. Extract Data
  const formData = new FormData(form);
  const data = Object.fromEntries(formData.entries());

  // 3. Send to Self-Hosted Backend
  try {
    const response = await fetch(`${API_CONFIG.baseUrl}/api/collections/${API_CONFIG.collections[type]}/records`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) throw new Error('Server rejected submission');

    // 4. Success State
    msg.innerText = 'Registration successful! We have received your abstract.';
    msg.classList.add('success');
    msg.hidden = false;
    form.reset();
  } catch (error) {
    // 5. Error State
    console.error(error);
    msg.innerText = 'Error submitting form. Please try again or contact support.';
    msg.classList.add('error');
    msg.hidden = false;
  } finally {
    btn.innerText = originalText;
    btn.disabled = false;
  }
}