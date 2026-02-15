import * as pdfjsLib from 'https://unpkg.com/pdfjs-dist@4.2.67/build/pdf.min.mjs';
import SignaturePad from 'https://unpkg.com/signature_pad@5.0.1/dist/signature_pad.min.js';
import QRCode from 'https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm';

const SRC_STAMPS_LOCAL_STORAGE_KEY = 'pdf-stamps-srcStamps';

pdfjsLib.GlobalWorkerOptions.workerSrc = '//unpkg.com/pdfjs-dist@4.2.67/build/pdf.worker.min.mjs';

const pdfRenderer = {
    numPages: 0,
    pageNum: 0,
    pdf: null,
    viewport: undefined,
    filename: '',
    stamps: [],
    mergeEntries: [],
    previewRecordIndex: 0
};

let srcStamps = [];
loadSrcStamps();

const loadTab = document.getElementById('loadTab');
const downloadTab = document.getElementById('downloadTab');
const loadSection = document.getElementById('loadSection');
const stampSection = document.getElementById('stampSection');

const dialog = document.getElementById('signature-dialog');
const colorPicker = document.getElementById('color-picker');
const padCanvas = document.getElementById('padCanvas');
const signaturePad = new SignaturePad(padCanvas);
const padClear = document.getElementById('padClear');
const padClose = document.getElementById('padClose');
const padStampAdd = document.getElementById('padStampAdd');

const mergeDialog = document.getElementById('merge-dialog');
const mergeEntriesInput = document.getElementById('mergeEntriesInput');
const mergeOk = document.getElementById('mergeOk');

const pageBox = document.getElementById('pageBox');
const pdfNav = document.getElementById('pdfNav');
const prevPage = document.getElementById('prevPage');
const nextPage = document.getElementById('nextPage');
const pageNum = document.getElementById('pageNum');
const numPages = document.getElementById('numPages');

const recordNav = document.getElementById('recordNav');
const prevRecord = document.getElementById('prevRecord');
const nextRecord = document.getElementById('nextRecord');
const recordSelect = document.getElementById('recordSelect');
const recordCount = document.getElementById('recordCount');

const fileInput = document.getElementById('fileInput');
const urlInput = document.getElementById('urlInput');
const btnLoad = document.getElementById('loadURL');

urlInput.value = '';

colorPicker.addEventListener('input', (event) => {
    signaturePad.penColor = event.target.value;
});

downloadTab.addEventListener('click', () => {
    generateStampedPdf();
});

loadTab.addEventListener('click', () => {
    fileInput.value = '';
    showSection(loadSection);
    setActiveTab(loadTab);
});

prevPage.addEventListener('click', () => {
    handlePageNum(pdfRenderer.pageNum - 1);
});

nextPage.addEventListener('click', () => {
    handlePageNum(pdfRenderer.pageNum + 1);
});

pageNum.addEventListener('change', () => {
    handlePageNum(parseInt(pageNum.value));
});

prevRecord.addEventListener('click', () => {
    if (pdfRenderer.mergeEntries.length === 0) {
        return;
    }
    pdfRenderer.previewRecordIndex = Math.max(0, pdfRenderer.previewRecordIndex - 1);
    renderRecordNav();
    renderPage(pdfRenderer.pageNum);
});

nextRecord.addEventListener('click', () => {
    if (pdfRenderer.mergeEntries.length === 0) {
        return;
    }
    pdfRenderer.previewRecordIndex = Math.min(pdfRenderer.mergeEntries.length - 1, pdfRenderer.previewRecordIndex + 1);
    renderRecordNav();
    renderPage(pdfRenderer.pageNum);
});

recordSelect.addEventListener('change', () => {
    pdfRenderer.previewRecordIndex = recordSelect.selectedIndex < 0 ? 0 : recordSelect.selectedIndex;
    renderRecordNav();
    renderPage(pdfRenderer.pageNum);
});

fileInput.addEventListener('change', handleFileInputChange);
fileInput.addEventListener('paste', handleFilePaste);

btnLoad.addEventListener('click', () => {
    fileInput.value = '';
    if (fileInput.files) {
        fileInput.files = null;
    }
    pdfRenderer.filename = pdfjsLib.getPdfFilenameFromUrl(urlInput.value);
    loadPdf(urlInput.value);
});

padClose.addEventListener('click', () => {
    dialog.close();
});

padClear.addEventListener('click', () => {
    signaturePad.clear();
});

padStampAdd.addEventListener('click', () => {
    if (!signaturePad.isEmpty()) {
        addSrcStamp({
            width: padCanvas.width,
            height: padCanvas.height,
            url: signaturePad.toDataURL(),
            kind: 'image'
        });
    }
    signaturePad.clear();
    dialog.close();
});

mergeOk.addEventListener('click', () => {
    setMergeEntries(getMergeEntriesFromInput());
    mergeDialog.close();
});

function showSection(section) {
    loadSection.classList.remove('active');
    stampSection.classList.remove('active');
    section.classList.add('active');
}

function setActiveTab(activeTab) {
    loadTab.classList.remove('active');
    if (activeTab) {
        activeTab.classList.add('active');
        downloadTab.disabled = true;
    }
}

function getMergeEntriesFromInput() {
    return mergeEntriesInput.value
        .split(/\r?\n/)
        .map(entry => entry.trim())
        .filter(entry => entry.length > 0);
}

function setMergeEntries(entries) {
    pdfRenderer.mergeEntries = entries;
    if (entries.length === 0) {
        pdfRenderer.previewRecordIndex = 0;
    } else {
        pdfRenderer.previewRecordIndex = Math.min(Math.max(pdfRenderer.previewRecordIndex, 0), entries.length - 1);
    }
    renderRecordNav();
    if (pdfRenderer.pdf) {
        renderPage(pdfRenderer.pageNum || 1);
    }
}

function getCurrentMergeRecord() {
    if (pdfRenderer.mergeEntries.length === 0) {
        return '';
    }
    return pdfRenderer.mergeEntries[pdfRenderer.previewRecordIndex] || '';
}

function showMergeDialog() {
    mergeEntriesInput.value = pdfRenderer.mergeEntries.join('\n');
    mergeDialog.showModal();
}

function renderRecordNav() {
    if (pdfRenderer.mergeEntries.length === 0) {
        recordNav.style.display = 'none';
        recordSelect.innerHTML = '';
        recordCount.innerText = '';
        return;
    }

    recordNav.style.display = 'flex';
    recordSelect.innerHTML = '';
    pdfRenderer.mergeEntries.forEach((entry, index) => {
        const option = document.createElement('option');
        option.innerText = `${index + 1}: ${entry}`;
        recordSelect.append(option);
    });
    recordSelect.selectedIndex = pdfRenderer.previewRecordIndex;
    recordCount.innerText = `${pdfRenderer.previewRecordIndex + 1}/${pdfRenderer.mergeEntries.length}`;
    prevRecord.disabled = pdfRenderer.previewRecordIndex === 0;
    nextRecord.disabled = pdfRenderer.previewRecordIndex === pdfRenderer.mergeEntries.length - 1;
}

function createSampleEntries() {
    return ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
}

function resolveStampText(stamp, recordText) {
    if (stamp.sourceMode === 'merge') {
        return ensureNonEmptyText(stamp, recordText || stamp.text);
    }
    return ensureNonEmptyText(stamp, stamp.text);
}

function getDefaultStampText(stamp) {
    return stamp.kind === 'qr' ? 'QR' : 'Text';
}

function ensureNonEmptyText(stamp, text) {
    const value = (text || '').trim();
    if (value.length > 0) {
        return value;
    }
    return getDefaultStampText(stamp);
}

function preventActionBarSelectionLoss(element) {
    ['pointerdown', 'mousedown', 'mouseup', 'click', 'touchstart'].forEach((eventName) => {
        element.addEventListener(eventName, (event) => {
            event.stopPropagation();
        });
    });
}

async function createQrStampDataUrl(text) {
    const qrSize = 220;
    const qrDataUrl = await QRCode.toDataURL(text, { width: qrSize, margin: 1 });
    const qrImage = await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.src = qrDataUrl;
    });
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(qrImage, 10, 10, qrSize, qrSize);
    return canvas.toDataURL('image/png');
}

async function getStampPreviewDataUrl(stamp, recordText) {
    if (stamp.kind === 'qr') {
        return createQrStampDataUrl(resolveStampText(stamp, recordText));
    }
    return stamp.url;
}

function getPreviewFontFamily(stampFont) {
    if (stampFont === 'TimesRoman') {
        return 'Times New Roman';
    }
    if (stampFont === 'Courier') {
        return 'Courier New';
    }
    return 'Helvetica';
}

function getPdfStandardFontName(stampFont) {
    if (stampFont === 'TimesRoman') {
        return PDFLib.StandardFonts.TimesRoman;
    }
    if (stampFont === 'Courier') {
        return PDFLib.StandardFonts.Courier;
    }
    return PDFLib.StandardFonts.Helvetica;
}

function addTextStampDirect() {
    if (!pdfRenderer.pdf || !pdfRenderer.viewport) {
        return;
    }

    let sourceMode = 'static';
    let text = 'Text';
    if (pdfRenderer.mergeEntries.length > 0) {
        sourceMode = 'merge';
        text = '';
    }

    addStamp({
        width: 520,
        height: 120,
        kind: 'text',
        sourceMode,
        text,
        fontSize: 42,
        color: '#000000',
        font: 'Helvetica'
    });
}

async function addQrStampDirect() {
    if (!pdfRenderer.pdf || !pdfRenderer.viewport) {
        return;
    }

    let sourceMode = 'static';
    let text = 'QR';
    if (pdfRenderer.mergeEntries.length > 0) {
        sourceMode = 'merge';
        text = '';
    }

    const previewText = sourceMode === 'merge' ? getCurrentMergeRecord() : text;
    addStamp({
        width: 240,
        height: 240,
        url: await createQrStampDataUrl(previewText || 'QR'),
        kind: 'qr',
        sourceMode,
        text
    });
}

async function handleAddQrAj() {
    if (!pdfRenderer.pdf || !pdfRenderer.viewport) {
        return;
    }

    setMergeEntries(createSampleEntries());
    addStamp({
        x: 0,
        y: 0,
        width: 520,
        height: 120,
        kind: 'text',
        sourceMode: 'merge',
        text: '',
        fontSize: 42,
        color: '#000000',
        font: 'Helvetica'
    });
    addStamp({
        x: 0,
        y: 130,
        width: 240,
        height: 240,
        url: await createQrStampDataUrl(getCurrentMergeRecord()),
        kind: 'qr',
        sourceMode: 'merge',
        text: ''
    });
}

function renderSrcStampsPreview() {
    const srcStampsPreview = document.getElementById('srcStampsPreview');
    srcStampsPreview.innerHTML = '';

    const sourceActions = document.createElement('div');
    sourceActions.classList.add('source-actions');

    const createGroup = (title) => {
        const group = document.createElement('div');
        group.classList.add('action-group');
        const heading = document.createElement('p');
        heading.classList.add('action-group-title');
        heading.innerText = title;
        group.append(heading);
        return group;
    };

    const typeGroup = createGroup('Stamp Type');
    const btnText = document.createElement('button');
    btnText.innerText = 'Text';
    btnText.id = 'addTextStamp';
    btnText.addEventListener('click', () => addTextStampDirect());
    typeGroup.append(btnText);

    const btnQr = document.createElement('button');
    btnQr.innerText = 'QR';
    btnQr.id = 'addQrStamp';
    btnQr.addEventListener('click', () => addQrStampDirect());
    typeGroup.append(btnQr);
    sourceActions.append(typeGroup);

    const mergeGroup = createGroup('Merge Actions');
    const btnMerge = document.createElement('button');
    btnMerge.innerText = 'Merge Data';
    btnMerge.id = 'manageMerge';
    btnMerge.addEventListener('click', () => showMergeDialog());
    mergeGroup.append(btnMerge);

    const btnQuickMerge = document.createElement('button');
    btnQuickMerge.innerText = 'Add QR (A-J)';
    btnQuickMerge.id = 'quickMerge';
    btnQuickMerge.classList.add('primary');
    btnQuickMerge.addEventListener('click', () => handleAddQrAj());
    mergeGroup.append(btnQuickMerge);
    sourceActions.append(mergeGroup);

    const importGroup = createGroup('Image & Signature');
    const btnLoadImage = document.createElement('button');
    btnLoadImage.innerText = 'Load Image';
    btnLoadImage.id = 'loadImageMenu';
    btnLoadImage.addEventListener('click', () => handleAddSrcStamp());
    importGroup.append(btnLoadImage);

    const btnAddSignature = document.createElement('button');
    btnAddSignature.innerText = 'Add Signature';
    btnAddSignature.id = 'addSrcStamp';
    btnAddSignature.addEventListener('click', () => showDialog());
    importGroup.append(btnAddSignature);
    sourceActions.append(importGroup);

    srcStampsPreview.append(sourceActions);

    srcStamps.forEach((s) => {
        const stamp = document.createElement('div');
        stamp.classList.add('stamp-source');
        stamp.style.backgroundImage = `url(${s.url})`;
        srcStampsPreview.append(stamp);
        stamp.addEventListener('click', () => addStamp(s));

        const remove = document.createElement('button');
        remove.innerText = 'X';
        remove.classList.add('remove');
        stamp.append(remove);
        remove.addEventListener('click', (event) => {
            event.stopImmediatePropagation();
            const index = srcStamps.indexOf(s);
            srcStamps.splice(index, 1);
            renderSrcStampsPreview();
            saveSrcStamps();
        });
    });
}

function handleAddSrcStamp() {
    const input = document.createElement('input');
    input.type = 'file';
    input.addEventListener('change', (event) => {
        if (event.target.files.length === 0) {
            return;
        }
        const files = event.target.files;
        const reader = new FileReader();
        reader.onload = function () {
            const img = new Image();
            img.onload = function () {
                addSrcStamp({
                    width: img.width,
                    height: img.height,
                    url: reader.result,
                    kind: 'image'
                });
                dialog.close();
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(files[0]);
    });
    input.click();
}

function showDialog() {
    dialog.showModal();
    resizeCanvas();
    signaturePad.clear();
}

function addSrcStamp(srcStamp) {
    if (srcStamps.length === 0) {
        addStamp(srcStamp);
    }
    srcStamps.push(srcStamp);
    renderSrcStampsPreview();
    saveSrcStamps();
}

function loadSrcStamps() {
    const srcStampsStr = localStorage.getItem(SRC_STAMPS_LOCAL_STORAGE_KEY);
    srcStamps = srcStampsStr ? JSON.parse(srcStampsStr) : [];
    renderSrcStampsPreview();
}

function saveSrcStamps() {
    localStorage.setItem(SRC_STAMPS_LOCAL_STORAGE_KEY, JSON.stringify(srcStamps));
}

function handleFilePaste(event) {
    handleFiles(event.clipboardData.files);
}

function handleFileInputChange(event) {
    handleFiles(event.target.files);
}

function handleFiles(files) {
    if (files.length === 0) {
        return;
    }
    const reader = new FileReader();
    reader.onload = function () {
        loadPdf(reader.result);
    };
    reader.readAsArrayBuffer(files[0]);
    pdfRenderer.filename = files[0].name;
}

function handlePageNum(num) {
    renderPage(num);
}

async function loadPdf(src) {
    pdfRenderer.pdf = await pdfjsLib.getDocument(src).promise;
    numPages.innerText = pdfRenderer.pdf.numPages;
    pageNum.setAttribute('max', pdfRenderer.pdf.numPages);
    pdfRenderer.numPages = pdfRenderer.pdf.numPages;
    pdfRenderer.stamps = [];
    renderRecordNav();
    renderPage(1);
    showSection(stampSection);
    setActiveTab(null);
    if (srcStamps.length === 0) {
        showDialog();
    }
}

async function renderPage(pageNumber) {
    if (!pdfRenderer.pdf) {
        return;
    }

    const safePageNumber = Math.min(Math.max(pageNumber, 1), pdfRenderer.numPages);
    pageNum.value = safePageNumber;
    pdfRenderer.pageNum = safePageNumber;
    prevPage.disabled = safePageNumber === 1;
    nextPage.disabled = safePageNumber === pdfRenderer.numPages;

    pageBox.innerHTML = '';
    const page = await pdfRenderer.pdf.getPage(safePageNumber);
    const viewport = page.getViewport({ scale: 1.0 });
    pdfRenderer.viewport = viewport;

    const canvas = document.createElement('canvas');
    pageBox.append(canvas);
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    pageBox.style.width = `${viewport.width}px`;
    pageBox.style.height = `${viewport.height}px`;

    await page.render({ canvasContext: context, viewport }).promise;

    await renderStamps();
    resizePageBox();
    renderPdfNav();
    renderDownloadTab();
}

function renderPdfNav() {
    pdfNav.style.display = pdfRenderer.numPages > 1 ? 'flex' : 'none';
}

function renderDownloadTab() {
    downloadTab.disabled = pdfRenderer.stamps.length === 0;
}

function updateStamp(stamp, img, div) {
    stamp.x = img.left;
    stamp.y = img.top;
    stamp.scaleX = img.scaleX;
    stamp.scaleY = img.scaleY;
    stamp.angle = img.angle;
    if (typeof img.width === 'number') {
        stamp.width = img.width;
    }
    if (typeof img.height === 'number') {
        stamp.height = img.height;
    }
    div.style.width = `${stamp.width * stamp.scaleX}px`;

    const topLeftX = stamp.x;
    const topLeftY = stamp.y;
    const height = (stamp.height + 20) * stamp.scaleY;
    const angle = -stamp.angle;
    const radians = angle * (Math.PI / 180);
    const bottomLeftX = topLeftX + height * Math.sin(radians);
    const bottomLeftY = topLeftY + height * Math.cos(radians);
    div.style.transform = `translate(${bottomLeftX}px, ${bottomLeftY}px)`;
}

async function renderStamps() {
    let stampCanvas = document.createElement('canvas');
    stampCanvas.height = pdfRenderer.viewport.height;
    stampCanvas.width = pdfRenderer.viewport.width;
    pageBox.append(stampCanvas);
    stampCanvas = new fabric.Canvas(stampCanvas);
    const currentRecord = getCurrentMergeRecord();

    for (const s of pdfRenderer.stamps) {
        if (s.startPage > pdfRenderer.pageNum) {
            continue;
        }
        if (s.repeatPage > 0 && (pdfRenderer.pageNum - s.startPage) % s.repeatPage !== 0) {
            continue;
        }
        if (s.repeatPage === 0 && s.startPage !== pdfRenderer.pageNum) {
            continue;
        }

        const renderObject = async () => {
            const div = document.createElement('div');
            div.classList.add('stamp');

            let img;
            if (s.kind === 'text') {
                img = new fabric.Text(resolveStampText(s, currentRecord), {
                    left: s.x,
                    top: s.y,
                    opacity: s.opacity,
                    scaleX: s.scaleX,
                    scaleY: s.scaleY,
                    angle: s.angle,
                    fill: s.color || '#000000',
                    fontSize: s.fontSize || 42,
                    fontFamily: getPreviewFontFamily(s.font || 'Helvetica'),
                    editable: false
                });
            } else {
                const previewUrl = await getStampPreviewDataUrl(s, currentRecord);
                img = await new Promise((resolve) => {
                    fabric.Image.fromURL(previewUrl, (image) => resolve(image));
                });
                img.set({
                    left: s.x,
                    top: s.y,
                    opacity: s.opacity,
                    scaleX: s.scaleX,
                    scaleY: s.scaleY,
                    angle: s.angle,
                });
            }

            img.on('moving', function () { updateStamp(s, img, div); });
            img.on('scaling', function () { updateStamp(s, img, div); });
            img.on('rotating', function () { updateStamp(s, img, div); });
            img.on('selected', function () { div.style.display = 'block'; });
            img.on('deselected', function () { div.style.display = 'none'; });

            stampCanvas.add(img);
            div.style.display = 'none';
            div.style.width = `${s.width * s.scaleX}px`;
            div.style.transform = `translate(${s.x}px, ${s.y + (s.height * s.scaleY)}px)`;

            const actionBar = document.createElement('div');
            actionBar.classList.add('action-bar');
            preventActionBarSelectionLoss(actionBar);
            div.append(actionBar);

            const inputRepeat = document.createElement('input');
            inputRepeat.classList.add('repeat');
            inputRepeat.type = 'number';
            inputRepeat.value = s.repeatPage;
            inputRepeat.min = 0;
            inputRepeat.addEventListener('change', (event) => {
                s.repeatPage = parseInt(event.target.value) || 0;
            });
            const inputRepeatLabel = document.createElement('label');
            inputRepeatLabel.innerText = 'Repeat on every n page';
            inputRepeatLabel.append(inputRepeat);
            actionBar.append(inputRepeatLabel);

            const inputOpacity = document.createElement('input');
            inputOpacity.classList.add('opacity');
            inputOpacity.type = 'range';
            inputOpacity.min = 0;
            inputOpacity.max = 100;
            inputOpacity.value = s.opacity * 100;
            inputOpacity.addEventListener('input', (event) => {
                s.opacity = parseFloat(event.target.value) / 100;
                img.opacity = s.opacity;
                stampCanvas.requestRenderAll();
            });
            const inputOpacityLabel = document.createElement('label');
            inputOpacityLabel.innerText = 'Opacity';
            inputOpacityLabel.append(inputOpacity);
            actionBar.append(inputOpacityLabel);

            if (s.kind === 'text' || s.kind === 'qr') {
                const inputText = document.createElement('input');
                inputText.type = 'text';
                inputText.value = s.text || '';
                inputText.disabled = s.sourceMode === 'merge';
                inputText.addEventListener('change', () => {
                    s.text = ensureNonEmptyText(s, inputText.value);
                    inputText.value = s.text;
                    renderPage(pdfRenderer.pageNum);
                });
                const inputTextLabel = document.createElement('label');
                inputTextLabel.innerText = 'Text';
                inputTextLabel.append(inputText);
                actionBar.append(inputTextLabel);

                const inputLinked = document.createElement('input');
                inputLinked.type = 'checkbox';
                inputLinked.checked = s.sourceMode === 'merge';
                inputLinked.addEventListener('change', async () => {
                    s.sourceMode = inputLinked.checked ? 'merge' : 'static';
                    inputText.disabled = inputLinked.checked;
                    if (inputLinked.checked && pdfRenderer.mergeEntries.length === 0) {
                        pdfRenderer.mergeEntries = createSampleEntries();
                        pdfRenderer.previewRecordIndex = 0;
                        renderRecordNav();
                    }
                    if (!inputLinked.checked) {
                        s.text = ensureNonEmptyText(s, s.text);
                        inputText.value = s.text;
                    } else {
                        inputText.value = resolveStampText(s, getCurrentMergeRecord());
                    }

                    if (s.kind === 'text' && img.type === 'text') {
                        img.set('text', resolveStampText(s, getCurrentMergeRecord()));
                        if (typeof img.width === 'number') {
                            s.width = img.width;
                        }
                        if (typeof img.height === 'number') {
                            s.height = img.height;
                        }
                        updateStamp(s, img, div);
                        stampCanvas.requestRenderAll();
                    }

                    if (s.kind === 'qr' && typeof img.setSrc === 'function') {
                        const qrText = resolveStampText(s, getCurrentMergeRecord());
                        const qrDataUrl = await createQrStampDataUrl(qrText);
                        await new Promise((resolve) => {
                            img.setSrc(qrDataUrl, () => {
                                if (typeof img.width === 'number') {
                                    s.width = img.width;
                                }
                                if (typeof img.height === 'number') {
                                    s.height = img.height;
                                }
                                updateStamp(s, img, div);
                                stampCanvas.requestRenderAll();
                                resolve();
                            });
                        });
                    }
                });
                const inputLinkedLabel = document.createElement('label');
                inputLinkedLabel.innerText = 'Link merge';
                inputLinkedLabel.append(inputLinked);
                actionBar.append(inputLinkedLabel);

                if (s.kind === 'text') {
                    const inputColor = document.createElement('input');
                    inputColor.type = 'color';
                    inputColor.value = s.color || '#000000';
                    inputColor.addEventListener('input', () => {
                        s.color = inputColor.value;
                        if (img.type === 'text') {
                            img.set('fill', s.color);
                            stampCanvas.requestRenderAll();
                        }
                    });
                    const inputColorLabel = document.createElement('label');
                    inputColorLabel.innerText = 'Color';
                    inputColorLabel.append(inputColor);
                    actionBar.append(inputColorLabel);

                    const fontSelect = document.createElement('select');
                    ['Helvetica', 'TimesRoman', 'Courier'].forEach(font => {
                        const option = document.createElement('option');
                        option.value = font;
                        option.innerText = font;
                        fontSelect.append(option);
                    });
                    fontSelect.value = s.font || 'Helvetica';
                    fontSelect.addEventListener('change', () => {
                        s.font = fontSelect.value;
                        if (img.type === 'text') {
                            img.set('fontFamily', getPreviewFontFamily(s.font));
                            if (typeof img.width === 'number') {
                                s.width = img.width;
                            }
                            stampCanvas.requestRenderAll();
                            updateStamp(s, img, div);
                        }
                    });
                    const fontSelectLabel = document.createElement('label');
                    fontSelectLabel.innerText = 'Font';
                    fontSelectLabel.append(fontSelect);
                    actionBar.append(fontSelectLabel);
                }
            }

            const btnRemove = document.createElement('button');
            btnRemove.innerText = '🗑 Delete';
            btnRemove.title = 'Delete stamp';
            btnRemove.setAttribute('aria-label', 'Delete stamp');
            btnRemove.classList.add('remove', 'pane-remove');
            actionBar.append(btnRemove);
            btnRemove.addEventListener('click', (event) => {
                event.stopImmediatePropagation();
                const index = pdfRenderer.stamps.indexOf(s);
                pdfRenderer.stamps.splice(index, 1);
                div.remove();
                stampCanvas.remove(img);
                stampCanvas.requestRenderAll();
                renderDownloadTab();
            });

            pageBox.append(div);
        };

        await renderObject();
    }
}

function addStamp(srcStamp) {
    if (!pdfRenderer.viewport) {
        return;
    }
    const scaleX = pdfRenderer.viewport.width / srcStamp.width;
    const scaleY = pdfRenderer.viewport.height / srcStamp.height;
    const scale = Math.min(scaleX, scaleY, 1.0);

    pdfRenderer.stamps.push({
        x: srcStamp.x || 0,
        y: srcStamp.y || 0,
        width: srcStamp.width,
        height: srcStamp.height,
        scaleX: srcStamp.scaleX || scale,
        scaleY: srcStamp.scaleY || scale,
        opacity: 1.0,
        angle: 0,
        startPage: pdfRenderer.pageNum,
        repeatPage: 0,
        url: srcStamp.url,
        kind: srcStamp.kind || 'image',
        sourceMode: srcStamp.sourceMode || 'static',
        text: srcStamp.text || '',
        fontSize: srcStamp.fontSize || 42,
        color: srcStamp.color || '#000000',
        font: srcStamp.font || 'Helvetica'
    });

    renderPage(pdfRenderer.pageNum);
}

function toRadians(degree) {
    return degree * (Math.PI / 180);
}

function hexToRgbParts(hex) {
    return {
        r: parseInt(hex.slice(1, 3), 16) / 255,
        g: parseInt(hex.slice(3, 5), 16) / 255,
        b: parseInt(hex.slice(5, 7), 16) / 255
    };
}

async function generateStampedPdf() {
    const sourcePdfBytes = await pdfRenderer.pdf.getData();
    let pdfBytesWithWatermark;

    if (pdfRenderer.mergeEntries.length > 0) {
        const mergedPdfDoc = await PDFLib.PDFDocument.create();
        for (const entry of pdfRenderer.mergeEntries) {
            const duplicatedPdfDoc = await PDFLib.PDFDocument.load(sourcePdfBytes);
            await applyStampsToPdfDoc(duplicatedPdfDoc, entry);
            const copiedPages = await mergedPdfDoc.copyPages(duplicatedPdfDoc, duplicatedPdfDoc.getPageIndices());
            copiedPages.forEach(page => mergedPdfDoc.addPage(page));
        }
        pdfBytesWithWatermark = await mergedPdfDoc.save();
    } else {
        const pdfDoc = await PDFLib.PDFDocument.load(sourcePdfBytes);
        await applyStampsToPdfDoc(pdfDoc);
        pdfBytesWithWatermark = await pdfDoc.save();
    }

    const blob = new Blob([pdfBytesWithWatermark], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = pdfRenderer.filename.replace('.pdf', '-stamped.pdf');
    document.body.append(downloadLink);
    downloadLink.click();

    URL.revokeObjectURL(url);
    downloadLink.remove();
}

async function applyStampsToPdfDoc(pdfDoc, mergeRecordText) {
    for (const stamp of pdfRenderer.stamps) {
        for (let i = stamp.startPage - 1; i < pdfRenderer.numPages; i += stamp.repeatPage > 0 ? stamp.repeatPage : pdfRenderer.numPages) {
            const page = pdfDoc.getPage(i);

            if (stamp.kind === 'text') {
                const textValue = resolveStampText(stamp, mergeRecordText || '');
                const fontSize = (stamp.fontSize || 42) * ((stamp.scaleX + stamp.scaleY) / 2);
                const pdfX = stamp.x;
                const pdfY = pdfRenderer.viewport.height - stamp.y - fontSize;
                const originX = pdfX;
                const originY = pdfY + fontSize;
                const angle = toRadians(-stamp.angle);
                const color = hexToRgbParts(stamp.color || '#000000');
                const font = await pdfDoc.embedFont(getPdfStandardFontName(stamp.font || 'Helvetica'));

                page.pushOperators(
                    PDFLib.pushGraphicsState(),
                    PDFLib.concatTransformationMatrix(1, 0, 0, 1, originX, originY),
                    PDFLib.concatTransformationMatrix(Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle), 0, 0),
                    PDFLib.concatTransformationMatrix(1, 0, 0, 1, -1 * originX, -1 * originY),
                );

                page.drawText(textValue, {
                    x: pdfX,
                    y: pdfY,
                    size: fontSize,
                    font,
                    color: PDFLib.rgb(color.r, color.g, color.b),
                    opacity: stamp.opacity
                });

                page.pushOperators(PDFLib.popGraphicsState());
                continue;
            }

            const stampUrl = stamp.kind === 'qr'
                ? await createQrStampDataUrl(resolveStampText(stamp, mergeRecordText || ''))
                : stamp.url;
            const image = await pdfDoc.embedPng(stampUrl);
            const pdfWidth = stamp.width * stamp.scaleX;
            const pdfHeight = stamp.height * stamp.scaleY;
            const pdfX = stamp.x;
            const pdfY = pdfRenderer.viewport.height - stamp.y - pdfHeight;

            const originX = pdfX;
            const originY = pdfY + pdfHeight;
            const angle = toRadians(-stamp.angle);

            page.pushOperators(
                PDFLib.pushGraphicsState(),
                PDFLib.concatTransformationMatrix(1, 0, 0, 1, originX, originY),
                PDFLib.concatTransformationMatrix(Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle), 0, 0),
                PDFLib.concatTransformationMatrix(1, 0, 0, 1, -1 * originX, -1 * originY),
            );

            page.drawImage(image, {
                x: pdfX,
                y: pdfY,
                width: pdfWidth,
                height: pdfHeight,
                opacity: stamp.opacity,
            });

            page.pushOperators(PDFLib.popGraphicsState());
        }
    }
}

function resizePageBox() {
    const viewportWidth = Math.min(window.innerWidth, document.documentElement.clientWidth - 40);
    const pageBoxWidth = pageBox.offsetWidth;
    const ratio = viewportWidth / pageBoxWidth;
    pageBox.style.transform = ratio < 1 ? `scale(${ratio})` : 'scale(1)';
}

function resizeCanvas() {
    padCanvas.width = padCanvas.offsetWidth;
    padCanvas.height = padCanvas.offsetHeight;
}

resizePageBox();
resizeCanvas();
renderRecordNav();
window.addEventListener('resize', resizePageBox, false);
