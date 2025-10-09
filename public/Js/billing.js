// /Js/billing.js

document.addEventListener('DOMContentLoaded', () => {
    fetchAndRenderBilling();
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
                <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-500 text-right">${formatCurrency(record.variableCost)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-500 text-right">${formatCurrency(record.baseFee)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-900 text-right">${formatCurrency(record.total)}</td>
            </tr>
        `;
        tableBody.insertAdjacentHTML('beforeend', row);
    });
}