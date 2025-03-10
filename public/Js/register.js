
document.getElementById('register-form').addEventListener('submit', function(event) {
    event.preventDefault();
    
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    // Basic validation
    if (password.length < 8) {
        document.getElementById('error-message').textContent = 'Password must be at least 8 characters long';
        document.getElementById('error-alert').classList.remove('d-none');
        document.getElementById('success-alert').classList.add('d-none');
        return;
    }
    
    if (password !== confirmPassword) {
        document.getElementById('error-message').textContent = 'Passwords do not match';
        document.getElementById('error-alert').classList.remove('d-none');
        document.getElementById('success-alert').classList.add('d-none');
        return;
    }
    
    // Hide error alert if validation passes
    document.getElementById('error-alert').classList.add('d-none');
    
    // Simulate registration process
    const registerButton = document.getElementById('register-button');
    registerButton.innerHTML = 'Processing...';
    registerButton.disabled = true
    

    
    // Simulate API call with timeout
    setTimeout(function() {
        // Show success message
        document.getElementById('success-alert').classList.remove('d-none');
        
        // For demo purposes, we'll redirect to login page after a delay
        setTimeout(function() {
            window.location.href = 'login.html';
        }, 2000);
        
        // Reset button state (in case registration fails)
        registerButton.innerHTML = 'Get Started';
        registerButton.disabled = false;
    }, 1000);
});

async function insertCompany(CompanyName) {
    try {
      const response = await fetch(`http://${window.miVariable}:3000/company/insert/${CompanyName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          docName: docName,
          timestampName: timestampName,
          vendor: chatGPTData.vendor_name,
          invoiceNumber: chatGPTData.invoice_number,
          invoiceStatus: 1,
          vendorAddress: chatGPTData.vendor_address,
          invoiceDate: chatGPTData.invoice_date,  // Asegúrate que sea el campo correcto
          dueDate: chatGPTData.invoice_due_date,
          fileURL: fileURL,
          fileType: fileType,
          invoiceTotal: chatGPTData.invoice_total
        })
      });
  
      const serverResponse = await response.json();
      return serverResponse.invoiceId;
    } catch (error) {
      console.error("Error en la inserción:", error);
      throw error;
    }
  }