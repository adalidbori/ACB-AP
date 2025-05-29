

async function fetchUsers() {
    console.log("Click")
    try {
        const res = await fetch('http://localhost:3000/getUsers', {
            method: 'GET',
        });

        if (!res.ok) {
            const err = await res.json();
            console.error('Error al obtener usuarios:', err);
            alert('Error al obtener usuarios');
            return;
        }
        const users = await res.json();

        populateUsersTable(users);
        // Aquí puedes renderizar la lista de usuarios en tu UI
    } catch (error) {
        console.error('Error de red:', error);
    }
}

function populateUsersTable(users) {
    const tableBody = document.getElementById('usersTableBody');
    tableBody.innerHTML = '';
    users.forEach(user => {
        const isChecked = user.Active ? 'checked' : '';
        const row = `
            <tr>
                <td>${user.FirstName || ''} ${user.LastName || ''}</td>
                <td>${user.WorkEmail || ''}</td>
                <td>${user.CompanyName || ''}</td>
                <td>${user.RoleName || ''}</td>
                <td>
                    <label class="switch">
                        <input type="checkbox" ${isChecked} >
                        <span class="slider round"></span>
                    </label>
                </td>
                <td>${user.CreatedAt || ''}</td>
            </tr>
        `;
        tableBody.insertAdjacentHTML('beforeend', row);
    });
}
cargarCompanias();
async function cargarCompanias() {
    try {
        const response = await fetch(`http://localhost:3000/companies`);
        companies = await response.json();
        const select = document.getElementById('companyId');
        select.innerHTML = '<option value="">Select a company</option>';
        companies.forEach(company => {
            const option = document.createElement('option');
            option.value = company.ID;
            option.textContent = company.CompanyName;
            select.appendChild(option);
        });

    } catch (error) {
        console.error('Error al cargar compañías:', error);
    }
}
const form = document.getElementById('inviteForm');

form.addEventListener('submit', async function (event) {
    event.preventDefault();

    // Mostrar spinner
    submitText.classList.add('d-none');
    submitSpinner.classList.remove('d-none');

    const formData = new FormData(form);
    const data = {
        WorkEmail: formData.get('workEmail'),
        CompanyID: formData.get('companyId'),
        RoleID: formData.get('roleId'),
    };
    try {
        const response = await fetch('http://localhost:3000/saveInvitation', {
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
        submitText.classList.remove('d-none');
        submitSpinner.classList.add('d-none');
    }
});

function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Render functions
function renderUsers() {
    cargarCompanias();
    fetchUsers();
}

function saveUser() {
    if (!currentEditingUserId) return;

    const updates = {
        firstName: document.getElementById('editFirstName').value.trim(),
        lastName: document.getElementById('editLastName').value.trim(),
        email: document.getElementById('editEmail').value.trim(),
        role: document.getElementById('editRole').value,
        status: document.getElementById('editStatus').value
    };

    // Validation
    if (!updates.firstName || !updates.lastName || !updates.email || !updates.role) {
        showToast('Please fill in all required fields.', 'error');
        return;
    }

    if (!validateEmail(updates.email)) {
        showToast('Please enter a valid email address.', 'error');
        return;
    }

    // Check if email already exists (excluding current user)
    if (users.some(user => user.id !== currentEditingUserId && user.email.toLowerCase() === updates.email.toLowerCase())) {
        showToast('A user with this email already exists.', 'error');
        return;
    }

    updateUser(currentEditingUserId, updates);
    showToast('User updated successfully!');

    // Hide modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('editUserModal'));
    modal.hide();

    currentEditingUserId = null;
}

// Event listeners
document.addEventListener('DOMContentLoaded', function () {

    // Tab change handler to refresh admin panel
    document.getElementById('admin-tab').addEventListener('shown.bs.tab', function () {
        renderUsers();
    });
});