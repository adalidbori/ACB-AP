document.addEventListener('DOMContentLoaded', () => {
    const resetForm = document.getElementById('resetPasswordForm');
    const messageArea = document.getElementById('message-area');
    const completeResetBtn = document.getElementById('completeResetBtn');

    // 1. Obtener el token de la URL
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    // Si no hay token, deshabilita el formulario
    if (!token) {
        messageArea.innerHTML = `<div class="alert alert-danger">Error: No reset token provided. Please request a new reset link.</div>`;
        resetForm.querySelectorAll('input, button').forEach(el => el.disabled = true);
        return;
    }

    resetForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        // 2. Obtener valores y validar
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        // Limpiar mensajes anteriores
        messageArea.innerHTML = '';

        if (password.length < 8) {
             messageArea.innerHTML = `<div class="alert alert-warning">Password must be at least 8 characters long.</div>`;
             return;
        }

        if (password !== confirmPassword) {
            messageArea.innerHTML = `<div class="alert alert-warning">Passwords do not match.</div>`;
            return;
        }

        // Deshabilitar el botón para prevenir múltiples envíos
        completeResetBtn.disabled = true;
        completeResetBtn.textContent = 'Processing...';

        try {
            // 3. Enviar datos al servidor
            const response = await fetch('/reset-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ token, password })
            });

            const data = await response.json();

            if (!response.ok) {
                // Muestra el mensaje de error del servidor (ej: token expirado)
                messageArea.innerHTML = `<div class="alert alert-danger">${data.message || 'An unknown error occurred.'}</div>`;
            } else {
                // 4. Manejar respuesta exitosa
                messageArea.innerHTML = `<div class="alert alert-success">${data.message} You will be redirected to the login page shortly.</div>`;
                resetForm.querySelectorAll('input, button').forEach(el => el.disabled = true);
                
                // Redirigir al login después de 3 segundos
                setTimeout(() => {
                    window.location.href = '/login';
                }, 3000);
            }
        } catch (error) {
            console.error('Reset password error:', error);
            messageArea.innerHTML = `<div class="alert alert-danger">A network error occurred. Please try again.</div>`;
        } finally {
            // Reactivar el botón si no hubo redirección
            if (!messageArea.querySelector('.alert-success')) {
                completeResetBtn.disabled = false;
                completeResetBtn.textContent = 'Complete Reset';
            }
        }
    });
});