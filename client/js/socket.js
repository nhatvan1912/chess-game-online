window.getAuthedSocket = function() {
  const token = localStorage.getItem('token') || '';
  const socket = io({
    auth: { token },
  });
  return socket;
};