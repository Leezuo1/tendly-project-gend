import styles from './landing.module.css';

/** Initialize the landing's product tour; release every listener and animation on navigation.
 * @param {HTMLElement} root
 */
export function initializeLanding(root) {
  const controller = new AbortController();
  const observers = [];
  const className = name => styles[name] || name;
  const selector = value => value.replace(/\.([a-zA-Z_][\w-]*)/g, (_, name) => '.' + className(name));
  const createObserver = (callback, options) => {
    const observer = new IntersectionObserver(callback, options);
    observers.push(observer);
    return observer;
  };
const scenes = [
    { name: 'Chăm sóc khách hàng', context: 'Câu hỏi từ khách', result: 'Gợi ý trả lời từ Tendly', status: 'Chờ shop duyệt', questions: ['Áo polo này có size L không ạ? Mình cao 1m72, nặng 68kg thì mặc size nào vừa?', 'Chất vải có bị xù lông không?', 'Mình muốn đổi màu sang xanh navy thì được không?'], answers: ['Dạ mẫu polo có size L ạ. Theo hướng dẫn của shop, với chiều cao 1m72 và cân nặng 68kg, bạn có thể tham khảo size L. Shop sẽ kiểm tra màu bạn chọn trước khi xác nhận nhé.', 'Áo dùng cotton co giãn ạ. Bạn giặt chế độ nhẹ, lộn trái áo và hạn chế sấy nhiệt cao theo hướng dẫn bảo quản của shop nhé.', 'Dạ bạn cho shop mã đơn và tình trạng sản phẩm để shop kiểm tra điều kiện đổi màu theo chính sách nhé.'] },
    { name: 'Livestream', context: 'Bình luận trong live', result: 'Gợi ý hỗ trợ phiên live', status: 'Shop xem lại trước', questions: ['Áo đang live còn size L không shop?', 'Mình lấy một áo navy size L nhé.', 'Shop có hỗ trợ đổi size không?'], answers: ['Có 3 khách cùng hỏi size L. Shop có thể trả lời chung: mẫu polo đang giới thiệu có size L, mình kiểm tra màu bạn cần trước khi xác nhận nhé.', 'Đã ghi nhận ý định mua của khách. Đơn vẫn là bản nháp; shop cần kiểm tra sản phẩm và thông tin khách trước khi xác nhận.', 'Theo chính sách của shop, shop hỗ trợ kiểm tra đổi size. Khách cần cung cấp tình trạng sản phẩm và thông tin đơn để shop xem điều kiện cụ thể.'] },
    { name: 'Marketing', context: 'Yêu cầu soạn nội dung', result: 'Bản nháp từ Tendly', status: 'Bản nháp · Chưa đăng', questions: ['Viết một bài Facebook ngắn giới thiệu áo polo, giọng gần gũi.', 'Cho mình thêm một góc viết cho ngày đi làm.', 'Viết một câu mở đầu nhẹ nhàng hơn nhé.'], answers: ['Một chiếc polo cho ngày nhẹ nhàng. Cotton co giãn, form regular dễ mặc. Nhắn shop màu và size bạn muốn để được tư vấn nhé.', 'Đi làm gọn gàng, cuối ngày vẫn thoải mái. Một chiếc polo cotton co giãn, form regular để bạn dễ phối cùng quần quen thuộc. Nhắn shop để chọn màu và size nhé.', 'Hôm nay, mặc đơn giản một chút nhé. Áo polo cotton co giãn, form regular — shop sẵn sàng tư vấn màu và size phù hợp với bạn.'] },
    { name: 'Tư vấn bán hàng', context: 'Nhu cầu của khách', result: 'Gợi ý tư vấn', status: 'Gợi ý · Shop xác nhận', questions: ['Mình tìm áo đi làm, thích mặc thoải mái, cao 1m72 nặng 68kg.', 'Có áo màu navy để dễ phối không?', 'Mình chưa chắc size, shop tư vấn giúp nhé.'], answers: ['Bạn có thể tham khảo polo form regular, cotton co giãn. Theo hướng dẫn chọn size, size L là một lựa chọn để shop kiểm tra thêm theo số đo và sở thích mặc của bạn.', 'Áo polo có màu navy, dễ phối cùng quần kaki hoặc jeans. Bạn cho shop biết size cần tìm để kiểm tra đúng phiên bản nhé.', 'Mình có thể bắt đầu từ size L theo thông tin bạn cung cấp. Bạn cho shop thêm số đo hoặc cách mặc mong muốn để shop tư vấn kỹ hơn trước khi quyết định nhé.'] }
];
scenes[1].items = ['Gom 3 khách hỏi size L', 'Đơn nháp áo navy', 'Đổi trả trong live'];
scenes[2].items = ['Góc kể nhẹ nhàng', 'Góc đồ đi làm', 'Câu mở đầu ngắn'];
scenes.push({ name: 'Smart Sourcing', context: 'Yêu cầu tìm nguồn', result: 'Gợi ý hướng tìm nguồn', status: 'Đề xuất nguồn hàng', source: 'Nguồn: Từ khóa & nhà cung cấp', items: ['Polo cotton co giãn', 'Tìm theo MOQ', 'Kiểm tra nhà cung cấp'], questions: ['Shop muốn tìm thêm nguồn áo polo cotton, form regular.', 'Shop mới nhập thử, nên hỏi nhà cung cấp những gì về MOQ?', 'Cần kiểm tra gì trước khi liên hệ một nhà cung cấp?'], answers: ['Thử nhóm từ khóa “áo polo cotton regular”, “polo co giãn sỉ”. So sánh chất liệu, bảng size và điều kiện nhập. Lọc nhà cung cấp theo chất liệu, mức nhập và khu vực để chọn nguồn phù hợp.', 'Hỏi số lượng tối thiểu theo mẫu, màu và size; phí mẫu, thời gian giao và chính sách lỗi. So sánh MOQ giữa các nhà cung cấp để lên kế hoạch nhập thử phù hợp.', 'Đối chiếu thông tin liên hệ, hồ sơ đơn vị, mẫu thực tế và điều khoản thanh toán. Lưu các lựa chọn phù hợp vào danh sách để theo dõi và liên hệ.'] });
const tabs = [...root.querySelectorAll(selector('[data-scene]'))];
const conversations = [...root.querySelectorAll(selector('[data-question]'))];
const names = ['Lan Anh', 'Minh Hoàng', 'Thảo Nguyên'];
const initials = ['LA', 'MH', 'TN'];
const workspace = root.querySelector(selector('#workspace'));
const frame = root.querySelector(selector('#workspace-frame'));
const draft = root.querySelector(selector('#demo-draft'));
const answer = root.querySelector(selector('#demo-answer'));
const editor = root.querySelector(selector('#draft-editor'));
const editLabel = root.querySelector(selector('.edit-label'));
const editButton = root.querySelector(selector('#edit-draft'));
const cancelButton = root.querySelector(selector('#cancel-edit'));
const approveButton = root.querySelector(selector('#approve-draft'));
const announcement = root.querySelector(selector('#demo-announcement'));
const autoplay = root.querySelector(selector('#autoplay-toggle'));
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const desktop = matchMedia('(min-width:761px)');
const finePointer = matchMedia('(hover:hover) and (pointer:fine)');
const marquee = root.querySelector(selector('.metric-band'));
let selected = 0;
let fullAnswer = answer.textContent;
let streamFrame = 0;
let streamVersion = 0;
let editing = false;
let userPlaying = true;
let heroVisible = false;
let marqueeVisible = false;
let hovered = false;
let marqueeHovered = false;
let timer = 0;
let startedAt = 0;
let remaining = 4500;
function completeStream() {
    cancelAnimationFrame(streamFrame);
    streamVersion++;
    answer.textContent = fullAnswer;
    draft.setAttribute('aria-busy', 'false');
    if (draft.dataset.state === 'streaming')
        draft.dataset.state = 'ready';
    approveButton.disabled = editing || draft.dataset.state === 'approved';
}
function streamAnswer(text, manual) {
    completeStream();
    fullAnswer = text;
    if (motion.matches || !heroVisible || document.hidden) {
        answer.textContent = text;
        return;
    }
    const version = ++streamVersion;
    const characters = Array.from(text);
    const start = performance.now();
    answer.textContent = '';
    draft.dataset.state = 'streaming';
    draft.setAttribute('aria-busy', 'true');
    approveButton.disabled = true;
    function tick(now) {
        if (version !== streamVersion)
            return;
        const count = Math.max(0, Math.floor((now - start - 300) / 2));
        answer.textContent = characters.slice(0, count).join('');
        if (count < characters.length)
            streamFrame = requestAnimationFrame(tick);
        else {
            completeStream();
            if (manual)
                announcement.textContent = 'Bản nháp đã sẵn sàng để sửa hoặc duyệt.';
        }
    }
    streamFrame = requestAnimationFrame(tick);
}
function syncMotion() {
    const canRun = userPlaying && heroVisible && !hovered && !document.hidden && !motion.matches && !editing;
    root.dataset.showtime = canRun ? 'running' : 'paused';
    marquee.dataset.running = String(userPlaying && marqueeVisible && !marqueeHovered && !document.hidden && !motion.matches);
    autoplay.disabled = motion.matches;
    autoplay.setAttribute('aria-pressed', String(userPlaying && !motion.matches));
    autoplay.textContent = motion.matches ? 'Chọn tab thủ công' : userPlaying ? 'Tạm dừng trình diễn' : 'Phát trình diễn';
    if (!canRun && timer) {
        clearTimeout(timer);
        timer = 0;
        remaining = Math.max(0, remaining - (performance.now() - startedAt));
    }
    if (canRun && !timer) {
        startedAt = performance.now();
        timer = setTimeout(() => { timer = 0; remaining = 4500; showDemo((selected + 1) % scenes.length, 0, false); syncMotion(); }, remaining);
    }
}
function stopManually() { userPlaying = false; syncMotion(); }
function endEditing() {
    editing = false;
    editor.hidden = true;
    editLabel.hidden = true;
    answer.hidden = false;
    cancelButton.hidden = true;
    editButton.textContent = 'Sửa nhanh';
    root.querySelector(selector('#edit-error')).hidden = true;
}
function resetCycle() {
    if (timer) {
        clearTimeout(timer);
        timer = 0;
    }
    remaining = 4500;
    const tab = tabs[selected];
    tab.style.setProperty('--progress-name', 'none');
    void getComputedStyle(tab, '::after').animationName;
    tab.style.removeProperty('--progress-name');
}
function showDemo(sceneIndex, questionIndex = 0, manual = true) {
    if (manual)
        stopManually();
    endEditing();
    selected = sceneIndex;
    const scene = scenes[sceneIndex];
    tabs.forEach((tab, index) => { tab.setAttribute('aria-selected', String(index === sceneIndex)); tab.tabIndex = index === sceneIndex ? 0 : -1; });
    root.querySelector(selector('#demo-panel')).setAttribute('aria-labelledby', 'tab-' + sceneIndex);
    conversations.forEach((button, index) => {
        button.setAttribute('aria-pressed', String(index === questionIndex));
        button.querySelector(selector('strong')).textContent = scene.items ? scene.items[index] : names[index];
        button.querySelector(selector('p')).textContent = scene.questions[index];
        button.querySelector(selector('.avatar')).textContent = scene.items ? String(index + 1).padStart(2, '0') : initials[index];
        button.querySelector(selector('time')).hidden = !!scene.items;
    });
    const isCustomer = sceneIndex === 0 || sceneIndex === 3;
    root.querySelector(selector('#demo-name')).textContent = isCustomer ? names[questionIndex] : (scene.items[questionIndex]);
    root.querySelector(selector('#demo-avatar')).textContent = isCustomer ? initials[questionIndex] : 'M';
    root.querySelector(selector('#demo-context')).textContent = scene.context;
    root.querySelector(selector('#demo-question')).textContent = scene.questions[questionIndex];
    root.querySelector(selector('#demo-result')).textContent = scene.result;
    root.querySelector(selector('#demo-status')).textContent = scene.status;
    root.querySelector(selector('#demo-source')).textContent = scene.source || 'Nguồn: Sản phẩm & FAQ của shop';
    root.querySelector(selector('#review-note')).textContent = 'Shop xem lại trước';
    approveButton.querySelector(selector('span')).textContent = sceneIndex === 2 ? 'Duyệt bản nháp đăng' : sceneIndex === 4 ? 'Duyệt hướng tìm nguồn' : 'Duyệt & chuẩn bị gửi';
    draft.dataset.state = 'ready';
    approveButton.disabled = false;
    announcement.textContent = '';
    resetCycle();
    streamAnswer(scene.answers[questionIndex], manual);
    syncMotion();
}
tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => showDemo(index), { signal: controller.signal });
    tab.addEventListener('keydown', event => {
        let next;
        if (event.key === 'ArrowRight')
            next = (index + 1) % tabs.length;
        if (event.key === 'ArrowLeft')
            next = (index + tabs.length - 1) % tabs.length;
        if (event.key === 'Home')
            next = 0;
        if (event.key === 'End')
            next = tabs.length - 1;
        if (next === undefined)
            return;
        event.preventDefault();
        showDemo(next);
        tabs[next].focus();
    }, { signal: controller.signal });
});
conversations.forEach((button, index) => button.addEventListener('click', () => showDemo(selected, index), { signal: controller.signal }));
editButton.addEventListener('click', () => {
    stopManually();
    completeStream();
    if (editing) {
        const value = editor.value.trim();
        if (!value) {
            root.querySelector(selector('#edit-error')).hidden = false;
            editor.setAttribute('aria-invalid', 'true');
            editor.focus();
            return;
        }
        fullAnswer = value;
        answer.textContent = value;
        endEditing();
        draft.dataset.state = 'ready';
        approveButton.disabled = false;
        root.querySelector(selector('#demo-status')).textContent = 'Đã sửa · Chờ shop duyệt';
        announcement.textContent = 'Đã lưu nội dung chỉnh sửa.';
        return;
    }
    editing = true;
    editor.value = fullAnswer;
    editor.hidden = false;
    editLabel.hidden = false;
    editor.removeAttribute('aria-invalid');
    answer.hidden = true;
    cancelButton.hidden = false;
    editButton.textContent = 'Lưu sửa';
    approveButton.disabled = true;
    editor.focus();
}, { signal: controller.signal });
cancelButton.addEventListener('click', () => { endEditing(); approveButton.disabled = draft.dataset.state === 'approved'; editButton.focus(); }, { signal: controller.signal });
editor.addEventListener('keydown', event => { if (event.key === 'Escape') {
    event.preventDefault();
    cancelButton.click();
} }, { signal: controller.signal });
approveButton.addEventListener('click', () => {
    stopManually();
    completeStream();
    draft.dataset.state = 'approved';
    approveButton.disabled = true;
    const ready = selected === 2 ? 'Đã duyệt — Sẵn sàng đăng' : selected === 4 ? 'Đã duyệt — Hướng tìm nguồn' : 'Đã duyệt — Sẵn sàng gửi';
    root.querySelector(selector('#demo-status')).textContent = ready;
    root.querySelector(selector('#review-note')).textContent = 'Shop đã duyệt nội dung';
    announcement.textContent = ready + '.';
    if (!motion.matches)
        for (let index = 0; index < 14; index++) {
            const particle = document.createElement('i');
            particle.className = className('particle');
            particle.setAttribute('aria-hidden', 'true');
            const angle = index * Math.PI * 2 / 14;
            particle.style.setProperty('--burst-x', Math.cos(angle) * 55 + 'px');
            particle.style.setProperty('--burst-y', Math.sin(angle) * 45 - 15 + 'px');
            draft.append(particle);
            particle.addEventListener('animationend', () => particle.remove(), { ...{ once: true }, signal: controller.signal });
        }
}, { signal: controller.signal });
autoplay.addEventListener('click', () => { if (editing)
    return; userPlaying = !userPlaying; syncMotion(); }, { signal: controller.signal });
workspace.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') {
    hovered = true;
    syncMotion();
} }, { signal: controller.signal });
workspace.addEventListener('pointerleave', () => { hovered = false; syncMotion(); frame.style.setProperty('--tilt-x', '0deg'); frame.style.setProperty('--tilt-y', '0deg'); }, { signal: controller.signal });
workspace.addEventListener('focusin', event => { if (event.target.closest(selector('[role=tab],.conversation,.draft')))
    stopManually(); }, { signal: controller.signal });
workspace.addEventListener('pointermove', event => {
    if (!finePointer.matches || motion.matches || !userPlaying || !heroVisible)
        return;
    const box = workspace.getBoundingClientRect();
    frame.style.setProperty('--tilt-x', ((.5 - (event.clientY - box.top) / box.height) * 2) + 'deg');
    frame.style.setProperty('--tilt-y', (((event.clientX - box.left) / box.width - .5) * 2) + 'deg');
}, { signal: controller.signal });
// Magnetic movement is decorative and only available with a fine pointer.
approveButton.addEventListener('pointermove', event => {
    if (!finePointer.matches || motion.matches || approveButton.disabled)
        return;
    const box = approveButton.getBoundingClientRect();
    approveButton.style.transform = 'translate(' + ((event.clientX - box.left - box.width / 2) * .07) + 'px,' + ((event.clientY - box.top - box.height / 2) * .09) + 'px)';
}, { signal: controller.signal });
approveButton.addEventListener('pointerleave', () => { approveButton.style.transform = ''; }, { signal: controller.signal });
marquee.addEventListener('pointerenter', () => { marqueeHovered = true; syncMotion(); }, { signal: controller.signal });
marquee.addEventListener('pointerleave', () => { marqueeHovered = false; syncMotion(); }, { signal: controller.signal });
document.addEventListener('visibilitychange', () => { if (document.hidden)
    completeStream(); syncMotion(); }, { signal: controller.signal });
motion.addEventListener('change', () => { completeStream(); if (motion.matches)
    draft.querySelectorAll(selector('.particle')).forEach(particle => particle.remove()); frame.style.setProperty('--tilt-x', '0deg'); frame.style.setProperty('--tilt-y', '0deg'); syncMotion(); }, { signal: controller.signal });
if ('IntersectionObserver' in window) {
    const visibility = createObserver(entries => { entries.forEach(entry => { if (entry.target === frame) {
        heroVisible = entry.isIntersecting;
        if (!heroVisible)
            completeStream();
    }
    else
        marqueeVisible = entry.isIntersecting; }); syncMotion(); }, { threshold: .1 });
    visibility.observe(frame);
    visibility.observe(marquee);
}
syncMotion();
const menuButton = root.querySelector(selector('.menu-button'));
const nav = root.querySelector(selector('#main-nav'));
function closeMenu() { nav.dataset.open = 'false'; menuButton.setAttribute('aria-expanded', 'false'); menuButton.setAttribute('aria-label', 'Mở menu'); }
menuButton.addEventListener('click', () => { const open = menuButton.getAttribute('aria-expanded') !== 'true'; nav.dataset.open = String(open); menuButton.setAttribute('aria-expanded', String(open)); menuButton.setAttribute('aria-label', open ? 'Đóng menu' : 'Mở menu'); }, { signal: controller.signal });
nav.querySelectorAll(selector('a')).forEach(link => link.addEventListener('click', closeMenu, { signal: controller.signal }));
root.querySelector(selector('.header')).addEventListener('keydown', event => { if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
    closeMenu();
    menuButton.focus();
} }, { signal: controller.signal });
desktop.addEventListener('change', closeMenu, { signal: controller.signal });
const chapterNames = ['Chăm sóc khách hàng', 'Livestream', 'Marketing', 'Tư vấn bán hàng'];
const chapters = [...root.querySelectorAll(selector('[data-chapter]'))];
const stage = root.querySelector(selector('#story-stage'));
const progress = [...root.querySelectorAll(selector('.story-progress a'))];
let activeChapter = 0;
let chapterFrame = 0;
function unveilImages(root) {
    root.querySelectorAll(selector('.image-unveil')).forEach(image => { image.querySelector(selector('img')).loading = 'eager'; image.classList.add(className('is-visible')); });
}
function showChapter(index) {
    chapters.forEach((chapter, i) => { chapter.dataset.active = String(i === index); });
    if (activeChapter === index) {
        unveilImages(stage.querySelector(selector('[data-canvas="' + index + '"]')));
        return;
    }
    activeChapter = index;
    root.querySelector(selector('#story-label')).textContent = chapterNames[index];
    stage.querySelectorAll(selector('[data-canvas]')).forEach((canvas, i) => { canvas.hidden = i !== index; });
    stage.dataset.chapter = String(index);
    progress.forEach((link, i) => { if (i === index)
        link.setAttribute('aria-current', 'step');
    else
        link.removeAttribute('aria-current'); });
    cancelAnimationFrame(chapterFrame);
    stage.dataset.changing = 'false';
    chapterFrame = requestAnimationFrame(() => { stage.dataset.changing = 'true'; stage.querySelectorAll(selector('[data-canvas="' + index + '"] .image-unveil')).forEach(image => image.classList.add(className('is-visible'))); });
}
showChapter(0);
// shortcut: four fixed chapters share a narrow activation band; revisit if their layout changes.
if ('IntersectionObserver' in window) {
    const observer = createObserver(entries => {
        if (!desktop.matches)
            return;
        const visible = entries.filter(entry => entry.isIntersecting);
        if (visible.length) {
            const nearest = visible.reduce((a, b) => Math.abs(a.boundingClientRect.top - innerHeight * .35) < Math.abs(b.boundingClientRect.top - innerHeight * .35) ? a : b);
            showChapter(Number(nearest.target.dataset.chapter));
        }
    }, { rootMargin: '-30% 0px -40% 0px', threshold: 0 });
    chapters.forEach(chapter => observer.observe(chapter));
}
progress.forEach((link, index) => link.addEventListener('click', () => showChapter(index), { signal: controller.signal }));
root.querySelector(selector('#open-sourcing')).addEventListener('click', () => showDemo(4), { signal: controller.signal });
root.querySelectorAll(selector('.confirm-order')).forEach(button => button.addEventListener('click', () => {
    button.textContent = 'Đã xác nhận';
    button.disabled = true;
    const status = button.closest(selector('.draft-order')).querySelector(selector('.order-status'));
    status.textContent = 'Shop đã xác nhận';
}, { signal: controller.signal }));
const revealTargets = [...root.querySelectorAll(selector('.section-heading,.steps li,.ecosystem>article,.faq details,.story-chapter h3,.story-chapter>p,.story-chapter .chapter-details'))];
revealTargets.forEach(element => element.dataset.reveal = '');
root.querySelectorAll(selector('.steps,.ecosystem,.faq,.story-chapter')).forEach(group => {
    [...group.children].forEach((element, index) => element.style.setProperty('--reveal-delay', Math.min(index, 2) * .15 + 's'));
});
if ('IntersectionObserver' in window) {
    const revealObserver = createObserver(entries => {
        entries.forEach(entry => { if (entry.isIntersecting) {
            entry.target.classList.add(className('is-visible'));
            unveilImages(entry.target);
            revealObserver.unobserve(entry.target);
        } });
    }, { rootMargin: '0px 0px -20% 0px', threshold: .04 });
    const targets = [...new Set([...revealTargets, ...[...root.querySelectorAll(selector('.image-unveil'))].map(image => image.parentElement)])];
    targets.forEach(element => { if (motion.matches) {
        element.classList.add(className('is-visible'));
        unveilImages(element);
    }
    else
        revealObserver.observe(element); });
    root.classList.add(className('motion-ready'));
    document.addEventListener('focusin', event => {
        const section = event.target.closest(selector('[data-reveal]'));
        if (section)
            section.classList.add(className('is-visible'));
    }, { signal: controller.signal });
}
const parallaxLayers = [...root.querySelectorAll(selector('.parallax-layer'))];
const storyContainer = root.querySelector(selector('.story'));
const stepsContainer = root.querySelector(selector('.steps'));
const nativeScroll = CSS.supports('animation-timeline:view()');
let visualFrame = 0;
function updateVisuals() {
    visualFrame = 0;
    if (document.hidden)
        return;
    parallaxLayers.forEach(element => {
        const box = element.getBoundingClientRect();
        if (!box.width || box.top > innerHeight + 100 || box.bottom < -100)
            return;
        const offset = motion.matches ? 0 : Math.max(-30, Math.min(30, (box.top + box.height / 2 - innerHeight * .5) / innerHeight * 35));
        element.style.setProperty('--parallax-y', offset.toFixed(1) + 'px');
    });
    if (!nativeScroll) {
        const storyBox = storyContainer.getBoundingClientRect(), stepsBox = stepsContainer.getBoundingClientRect();
        storyContainer.style.setProperty('--story-progress', Math.max(0, Math.min(1, (innerHeight * .5 - storyBox.top) / Math.max(1, storyBox.height - innerHeight * .5))));
        stepsContainer.style.setProperty('--steps-progress', Math.max(0, Math.min(1, (innerHeight * .8 - stepsBox.top) / Math.max(1, stepsBox.height * .8))));
    }
}
function scheduleVisuals() { if (!visualFrame)
    visualFrame = requestAnimationFrame(updateVisuals); }
window.addEventListener('scroll', scheduleVisuals, { ...{ passive: true }, signal: controller.signal });
window.addEventListener('resize', scheduleVisuals, { signal: controller.signal });
document.addEventListener('visibilitychange', scheduleVisuals, { signal: controller.signal });
motion.addEventListener('change', () => {
    if (motion.matches) {
        root.querySelectorAll(selector('[data-reveal],.image-unveil')).forEach(element => element.classList.add(className('is-visible')));
        root.querySelectorAll(selector('.image-unveil img')).forEach(image => image.loading = 'eager');
        parallaxLayers.forEach(element => element.style.setProperty('--parallax-y', '0px'));
    }
    scheduleVisuals();
}, { signal: controller.signal });
scheduleVisuals();

  return () => {
    controller.abort();
    observers.forEach(observer => observer.disconnect());
    clearTimeout(timer);
    cancelAnimationFrame(streamFrame);
    cancelAnimationFrame(chapterFrame);
    cancelAnimationFrame(visualFrame);
    root.classList.remove(styles['motion-ready']);
    root.removeAttribute('data-showtime');
    chapters.forEach(chapter => chapter.removeAttribute('data-active'));
    draft.querySelectorAll(selector('.particle')).forEach(particle => particle.remove());
  };
}
