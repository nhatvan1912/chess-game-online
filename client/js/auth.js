const usernameEl = document.getElementById('username');
const passwordEl = document.getElementById('password');
const msg = document.getElementById('msg');

document.getElementById('btnLogin').onclick = async () => {
  try {
    const { token, user } = await API.login({ username: usernameEl.value, password: passwordEl.value });
    localStorage.setItem('token', token);
    localStorage.setItem('username', user.username);
    window.location.href = '/home.html';
  } catch (e) { msg.textContent = e.message; }
};

document.getElementById('btnRegister').onclick = async () => {
  try {
    await API.register({ username: usernameEl.value, password: passwordEl.value });
    msg.textContent = 'Đăng ký thành công, hãy đăng nhập';
  } catch (e) { msg.textContent = e.message; }
};