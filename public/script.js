// Fungsi untuk menjalankan animasi angka (Counter)
function startCounting() {
    const counters = document.querySelectorAll('.counter');
    const speed = 100; // Semakin kecil, semakin lambat

    counters.forEach(counter => {
        const updateCount = () => {
            const target = +counter.getAttribute('data-target');
            const count = +counter.innerText;
            const increment = target / speed;

            if (count < target) {
                counter.innerText = Math.ceil(count + increment);
                setTimeout(updateCount, 20); // Update setiap 20ms
            } else {
                counter.innerText = target;
            }
        };
        updateCount();
    });
}

// Jalankan fungsi ketika halaman selesai dimuat sepenuhnya
window.addEventListener('load', () => {
    console.log("File script.js berhasil terbaca!"); // Cek di console
    startCounting();
});
function toggleGaleriInput() {
    const tipe = document.getElementById('tipe_galeri').value;
    document.getElementById('input_foto').style.display = tipe === 'foto' ? 'block' : 'none';
    document.getElementById('input_video').style.display = tipe === 'video' ? 'block' : 'none';
}