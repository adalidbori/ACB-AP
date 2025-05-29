const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');
if (token) {
    console.log("complete registration: "+token)
}

// Validación de contraseñas
document.getElementById('completeRegistrationForm').addEventListener('submit', function (e) {
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    if (password !== confirmPassword) {
        e.preventDefault();
        alert("Passwords do not match.");
    }
});

const form = document.getElementById('completeRegistrationForm');
form.addEventListener('submit', async function (event) {
    event.preventDefault();

    const formData = new FormData(form);
    const data = {
        FirstName: formData.get('firstName'),
        LastName: formData.get('lastName'),
        Password: formData.get('password'),
        Phone: formData.get('phone'),
        Token: token
    };
    try {
        const response = await fetch('http://localhost:3000/saveUser', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        const result = await response.json();

        if (response.ok) {
            form.reset(); // Limpia el formulario
        } else {
            alert('Error: ' + result.message);
        }
    } catch (error) {
        alert('Error de red: ' + error.message);
    } finally {
        // Ocultar spinner
        //submitText.classList.remove('d-none');
        //submitSpinner.classList.add('d-none');
    }
});

