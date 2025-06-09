const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');
if (token) {
    console.log("complete registration: "+token)
}

const form = document.getElementById('completeRegistrationForm');

form.addEventListener('submit', async function (event) {
    event.preventDefault(); // siempre prevenir envío por defecto

    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (password !== confirmPassword) {
        alert("Passwords do not match.");
        return; // detener el envío
    }

    const formData = new FormData(form);
    const data = {
        FirstName: formData.get('firstName'),
        LastName: formData.get('lastName'),
        Password: formData.get('password'),
        Phone: formData.get('phone'),
        Token: token
    };

    try {
        const response = await fetch('/saveUser', {
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
            alert('Error: user already created!');
        }
    } catch (error) {
        alert('Error de red: ' + error.message);
    }
});


