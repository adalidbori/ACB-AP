async function login() {
    try {
        const email = document.getElementById('emailLogin').value;
        const password = document.getElementById('passLogin').value;

        const res = await fetch('/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include', // 🔑 MUY IMPORTANTE para enviar/recibir cookies
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (!res.ok) {
            showMessage(data.message || 'Invalid user or password!', 'error');
        } else {
            window.location.href = '/';
        }

    } catch (error) {
        console.error("Error logging in:", error);
        showMessage('Server error. Try again later.', 'error');
    }
}


//showMessage(`Invalid user or password!`, 'error');

function showMessage(msg, type = 'success') {
    const el = document.getElementById('emailStatusLogin');
    el.textContent = msg;
    el.style.backgroundColor = type === 'success' ? '#28a745' : '#dc3545';
    el.style.display = 'block';

    // Oculta después de 4s
    setTimeout(() => {
        el.style.display = 'none';
    }, 4000);
}

function clearField(fieldId) {
    document.getElementById(fieldId).value = '';
}