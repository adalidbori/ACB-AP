function clearField(fieldId) {
    document.getElementById(fieldId).value = '';
}

document.querySelector('form').addEventListener('submit', function (e) {
    e.preventDefault();
    const email = document.getElementById("reset-password-email").value;
    checkIfEmailExists(email);
});

async function checkIfEmailExists(email) {
    try {
        const res = await fetch('http://localhost:3000/checkEmailExists', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        const data = await res.json();

        if (data.exists) {
            // Ahora sí, llama a requestPasswordReset
            const resetRes = await fetch('http://localhost:3000/requestPasswordReset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const resetData = await resetRes.json();

            if (resetData.ok) {
                alert("Check your inbox for the reset link!");
            } else {
                alert("Error sending reset email. Try again later.");
            }
        } else {
            alert("Email not found in our records.");
        }
    } catch (err) {
        console.error('Error:', err);
        alert("Sorry, we can't proceed right now!");
    }
}

