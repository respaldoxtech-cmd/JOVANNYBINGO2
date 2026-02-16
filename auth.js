document.addEventListener('DOMContentLoaded', () => {
    // Elementos del DOM
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const formLoginContainer = document.getElementById('form-login');
    const formRegisterContainer = document.getElementById('form-register');
    const errorDisplay = document.getElementById('error-display');

    // Gestión de Pestañas
    function switchTab(tab) {
        errorDisplay.textContent = '';
        
        if (tab === 'login') {
            tabLogin.classList.add('active');
            tabRegister.classList.remove('active');
            formLoginContainer.classList.remove('hidden');
            formLoginContainer.classList.add('fade-in');
            formRegisterContainer.classList.add('hidden');
            formRegisterContainer.classList.remove('fade-in');
        } else {
            tabRegister.classList.add('active');
            tabLogin.classList.remove('active');
            formRegisterContainer.classList.remove('hidden');
            formRegisterContainer.classList.add('fade-in');
            formLoginContainer.classList.add('hidden');
            formLoginContainer.classList.remove('fade-in');
        }
    }

    tabLogin.addEventListener('click', () => switchTab('login'));
    tabRegister.addEventListener('click', () => switchTab('register'));

    // Manejo de Login
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = loginForm.querySelector('button');
        setLoading(btn, true);

        const username = document.getElementById('login-user').value;
        const password = document.getElementById('login-pass').value;

        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();

            if (data.success) {
                // Guardar sesión y redirigir
                localStorage.setItem('yovanny_user', JSON.stringify(data));
                window.location.href = '/game.html'; // Asumiendo que el juego está aquí o en otra ruta
            } else {
                showError(data.error || 'Error al iniciar sesión');
            }
        } catch (err) {
            showError('Error de conexión con el servidor');
        } finally {
            setLoading(btn, false);
        }
    });

    // Manejo de Registro
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = registerForm.querySelector('button');
        setLoading(btn, true);

        const username = document.getElementById('reg-user').value;
        const password = document.getElementById('reg-pass').value;

        try {
            const res = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();

            if (data.success) {
                // Auto-login tras registro exitoso
                switchTab('login');
                document.getElementById('login-user').value = username;
                document.getElementById('login-pass').value = password;
                showError('¡Registro exitoso! Iniciando sesión...', 'green');
                setTimeout(() => loginForm.dispatchEvent(new Event('submit')), 1000);
            } else {
                showError(data.error || 'Error al registrarse');
            }
        } catch (err) {
            showError('Error de conexión con el servidor');
        } finally {
            setLoading(btn, false);
        }
    });

    function showError(msg, color = '#ef4444') {
        errorDisplay.style.color = color;
        errorDisplay.textContent = msg;
        errorDisplay.classList.add('fade-in');
    }

    function setLoading(btn, isLoading) {
        if (isLoading) {
            btn.dataset.originalText = btn.textContent;
            btn.textContent = 'Procesando...';
            btn.disabled = true;
            btn.style.opacity = '0.7';
        } else {
            btn.textContent = btn.dataset.originalText;
            btn.disabled = false;
            btn.style.opacity = '1';
        }
    }
});