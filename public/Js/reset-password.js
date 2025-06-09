function clearField(fieldId) {
    console.log(fieldId);
    document.getElementById(fieldId).value = '';
}

document.querySelector('form').addEventListener('submit', function (e) {
    e.preventDefault();
    const email = document.getElementById("reset-password-email").value;
    checkIfEmailExists(email);
});

async function checkIfEmailExists(email) {
    try {
        const res = await fetch('/checkEmailExists', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        const data = await res.json();

        if (data.exists) {
            // Ahora sí, llama a requestPasswordReset
            const resetRes = await fetch('/requestPasswordReset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const resetData = await resetRes.json();

            if (resetData.ok) {
                //alert("Check your inbox for the reset link!");
                clearField('reset-password-email');
            } else {
                alert("Error sending reset email. Try again later.");
            }
        } else {
            //alert("Email not found in our records.");
            clearField('reset-password-email');
        }
    } catch (err) {
        console.error('Error:', err);
        alert("Sorry, we can't proceed right now!");
    }
}


