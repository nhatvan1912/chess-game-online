// ✅ Kết nối đến server
const socket = io('http://localhost:5500');

let currentRoomId = null;
let playerColor = null;

// Kiểm tra kết nối
socket.on('connect', () => {
    console.log('✅ Đã kết nối Socket.IO:', socket.id);
});

socket.on('connect_error', (error) => {
    console.error('❌ Lỗi kết nối:', error);
    alert('Không thể kết nối đến server! Hãy kiểm tra server đã chạy chưa.');
});

// Tạo phòng
function createRoom() {
    const playerName = document.getElementById('createPlayerName').value.trim();
    
    if (!playerName) {
        alert('⚠️ Vui lòng nhập tên của bạn!');
        return;
    }

    socket.emit('createRoom', playerName);
    console.log('📤 Đã gửi yêu cầu tạo phòng');
}

// Tham gia phòng
function joinRoom() {
    const playerName = document.getElementById('joinPlayerName').value.trim();
    const roomId = document.getElementById('roomId').value.trim().toUpperCase();
    
    if (!playerName || !roomId) {
        alert('⚠️ Vui lòng nhập đầy đủ thông tin!');
        return;
    }

    socket.emit('joinRoom', { roomId, playerName });
    console.log('📤 Đã gửi yêu cầu tham gia phòng:', roomId);
}

// Nhận phản hồi từ server
socket.on('roomCreated', ({ roomId, color }) => {
    currentRoomId = roomId;
    playerColor = color;
    
    document.getElementById('currentRoomId').textContent = roomId;
    document.getElementById('roomInfo').style.display = 'block';
    
    alert(`✅ Phòng đã được tạo!\n🎯 Mã phòng: ${roomId}\n♟️ Bạn chơi quân: ${color === 'white' ? 'TRẮNG' : 'ĐEN'}`);
});

socket.on('roomJoined', ({ roomId, color }) => {
    currentRoomId = roomId;
    playerColor = color;
    
    alert(`✅ Đã tham gia phòng ${roomId}!\n♟️ Bạn chơi quân: ${color === 'white' ? 'TRẮNG' : 'ĐEN'}`);
});

socket.on('gameStart', ({ players }) => {
    console.log('🎮 Game bắt đầu!', players);
    alert('🎮 Đối thủ đã tham gia! Game bắt đầu!');
});

socket.on('error', (message) => {
    alert('❌ Lỗi: ' + message);
});

// Copy room ID
function copyRoomId() {
    const roomId = document.getElementById('currentRoomId').textContent;
    navigator.clipboard.writeText(roomId);
    alert('✅ Đã copy mã phòng: ' + roomId);
}