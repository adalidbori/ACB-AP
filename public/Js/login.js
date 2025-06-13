// Espera a que todo el contenido del DOM esté cargado
document.addEventListener('DOMContentLoaded', function () {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        // Escucha el evento 'submit' del formulario
        loginForm.addEventListener('submit', function(event) {
            event.preventDefault(); // Previene que la página se recargue
            login(); // Llama a la función de login
        });
    }

    // Lógica para mostrar/ocultar la contraseña
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('passLogin');

    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', function () {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            this.classList.toggle('bi-eye-slash-fill');
            this.classList.toggle('bi-eye-fill');
        });
    }
});

/**
 * Valida los campos y, si son correctos, intenta iniciar sesión.
 */
async function login() {
    const emailInput = document.getElementById('emailLogin');
    const passwordInput = document.getElementById('passLogin');
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    // --- 1. VALIDACIÓN DE CAMPOS ---
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email === "") {
        showMessage("Please enter your email address.", "error");
        emailInput.focus();
        return; // Detiene la ejecución si hay un error
    }
    if (!emailRegex.test(email)) {
        showMessage("Please enter a valid email address.", "error");
        emailInput.focus();
        return; // Detiene la ejecución si hay un error
    }
    if (password === "") {
        showMessage("Please enter your password.", "error");
        passwordInput.focus();
        return; // Detiene la ejecución si hay un error
    }

    // --- 2. SI LA VALIDACIÓN PASA, SE EJECUTA EL FETCH ---
    try {
        const res = await fetch('/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include', // MUY IMPORTANTE para enviar/recibir cookies
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (!res.ok) {
            // Usa el mensaje del servidor si existe, si no, uno genérico.
            showMessage(data.message || 'Invalid credentials!', 'error');
        } else {
            // Muestra un mensaje de éxito y redirige
            showMessage('Login successful! Redirecting...', 'success');
            setTimeout(() => {
                 window.location.href = '/dashboard';
            }, 1000); // Espera 1 segundo para que el usuario vea el mensaje
        }

    } catch (error) {
        console.error("Error during login request:", error);
        showMessage('A server error occurred. Please try again later.', 'error');
    }
}

/**
 * Muestra un mensaje de estado (éxito o error).
 * @param {string} msg - El mensaje a mostrar.
 * @param {'success'|'error'} type - El tipo de mensaje.
 */
function showMessage(msg, type = 'success') {
    const el = document.getElementById('emailStatusLogin');
    if (!el) return;

    el.textContent = msg;
    el.style.backgroundColor = type === 'success' ? '#28a745' : '#dc3545';
    el.style.display = 'block';

    // Oculta el mensaje después de 4 segundos
    setTimeout(() => {
        el.style.display = 'none';
    }, 4000);
}
