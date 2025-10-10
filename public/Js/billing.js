// /Js/billing.js

document.addEventListener('DOMContentLoaded', () => {
    fetchAndRenderBilling();
    updateMenuVisibilityByRole();

    // --- CÓDIGO NUEVO PARA EL MENÚ DE USUARIO ---
    const userMenuButton = document.getElementById('user-menu-button');
    const userMenu = document.getElementById('user-menu');

    // Muestra u oculta el menú al hacer clic en el botón
    userMenuButton.addEventListener('click', (event) => {
        event.stopPropagation(); // Evita que el clic se propague al 'document'
        userMenu.classList.toggle('hidden');
    });

    // Oculta el menú si se hace clic en cualquier otro lugar de la página
    document.addEventListener('click', (event) => {
        if (!userMenu.classList.contains('hidden') && !userMenuButton.contains(event.target)) {
            userMenu.classList.add('hidden');
        }
    });
    // --- FIN DEL CÓDIGO NUEVO ---
});

async function fetchAndRenderBilling() {
    try {
        const response = await fetch('/getBillingData');
        if (!response.ok) {
            throw new Error('Failed to fetch billing data');
        }
        const data = await response.json();
        
        renderCurrentMonth(data.currentBilling);
        renderBillingHistory(data.billingHistory);

    } catch (error) {
        console.error('Error:', error);
        // Puedes mostrar un mensaje de error en la UI
    }
}

function renderCurrentMonth(billing) {
    // Helper para formatear a moneda
    const formatCurrency = (amount) => `$${amount.toFixed(2)}`;

    document.getElementById('current-month-name').textContent = billing.monthName;
    document.getElementById('current-month-invoices').textContent = billing.invoiceCount;
    document.getElementById('current-month-base').textContent = formatCurrency(billing.baseFee);
    document.getElementById('current-month-variable').textContent = formatCurrency(billing.variableCost);
    document.getElementById('current-month-total').textContent = formatCurrency(billing.total);
}

function renderBillingHistory(history) {
    const tableBody = document.getElementById('billing-history-table');
    tableBody.innerHTML = ''; // Limpiar el mensaje de "Loading"

    if (history.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center p-4">No billing history found.</td></tr>';
        return;
    }

    const formatCurrency = (amount) => `$${amount.toFixed(2)}`;

    history.forEach(record => {
        const row = `
            <tr class="hover:bg-slate-50">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">${record.monthName}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-500 text-center">${record.invoiceCount}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-500 text-right">${formatCurrency(record.baseFee)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-500 text-right">${formatCurrency(record.variableCost)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-900 text-right">${formatCurrency(record.total)}</td>
            </tr>
        `;
        tableBody.insertAdjacentHTML('beforeend', row);
    });
}

async function updateMenuVisibilityByRole() {
    try {
        const res = await fetch('/getCurrentUser', {
            method: 'GET',
            credentials: 'include',
        });

        if (!res.ok) throw new Error('Unauthorized');

        const data = await res.json();

        console.log(`Data del usuario ${data.email}`)

        // AÑADIDO PARA DEPURACIÓN: Muestra el objeto exacto en la consola
        console.log("Datos recibidos del servidor:", data);

        // ¡CORRECCIÓN CLAVE! Usamos data.role (minúscula) porque así lo envía el servidor.
        const userRole = data.role;

        // --- LÓGICA PARA POPULAR LA INFO DEL USUARIO ---
        const userName = data.name || '';
        const userEmail = data.email || '';
        console.log(data.name);
        const getInitials = (name) => {
            if (!name) return '--'; // Controlar si el nombre es nulo o undefined
            const names = name.split(' ');
            if (names.length > 1 && names[1]) {
                return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
            }
            if (name.length > 1) {
                return name.substring(0, 2).toUpperCase();
            }
            return name.toUpperCase();
        };

        const initials = getInitials(userName);

        document.getElementById('user-initials').textContent = initials;
        document.getElementById('user-name-sidebar').textContent = userName;
        document.getElementById('user-name-dropdown').textContent = userName;
        document.getElementById('user-email-dropdown').textContent = userEmail;

        // El resto de tu lógica de visibilidad debería funcionar ahora correctamente
        const settingsBtn = document.getElementById('openSettings');
        console.log(`Role del usuario: ${userRole}`);
        if (settingsBtn && userRole === 1) {
            settingsBtn.style.display = 'flex';
        }

        const billingLink = document.getElementById('billing-link');
        if (billingLink && (userRole === 1 || userRole === 3)) {
            billingLink.style.display = 'flex';
        }

    } catch (err) {
        // AÑADIDO PARA DEPURACIÓN: Muestra si la función falló
        console.error('Error detallado en updateMenuVisibilityByRole:', err);
        document.getElementById('user-name-sidebar').textContent = 'Error';
        document.getElementById('user-initials').textContent = 'X';
    }
}