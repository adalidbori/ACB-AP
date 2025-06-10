document.addEventListener('DOMContentLoaded', () => {
    const resetForm = document.getElementById('reset-form');
    const emailInput = document.getElementById('reset-password-email');
    const messageArea = document.getElementById('message-area');
    const submitBtn = document.getElementById('submit-btn');

    resetForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = emailInput.value;
        if (!email) {
            messageArea.innerHTML = `<div class="alert alert-warning">Please enter an email address.</div>`;
            return;
        }

        // Deshabilitar UI y mostrar estado de carga
        submitBtn.disabled = true;
        submitBtn.textContent = 'Processing...';
        messageArea.innerHTML = '';

        try {
            const response = await fetch('/requestPasswordReset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            
            // Si el servidor tuvo un error grave (500), response.ok será falso
            if (!response.ok) {
                 throw new Error('Server responded with an error.');
            }

            // Para CUALQUIER respuesta exitosa (200), muestra el mensaje genérico.
            messageArea.innerHTML = `<div class="alert alert-success">If an account with this email exists, a password reset link has been sent.</div>`;
            emailInput.value = ''; // Limpiar el campo

        } catch (error) {
            console.error('Error:', error);
            messageArea.innerHTML = `<div class="alert alert-danger">An unexpected error occurred. Please try again later.</div>`;
        } finally {
            // Vuelve a habilitar el botón, pero mantenlo deshabilitado si el mensaje fue exitoso para evitar reenvíos
            if (!messageArea.querySelector('.alert-success')) {
                submitBtn.disabled = false;
            }
            submitBtn.textContent = 'Submit';
        }
    });
});