import * as pdfjsLib from 'https://unpkg.com/pdfjs-dist@4.2.67/build/pdf.min.mjs';
import SignaturePad from 'https://unpkg.com/signature_pad@5.0.1/dist/signature_pad.min.js';

const SRC_STAMPS_LOCAL_STORAGE_KEY = 'pdf-stamps-srcStamps';

// The workerSrc property shall be specified.
pdfjsLib.GlobalWorkerOptions.workerSrc = '//unpkg.com/pdfjs-dist@4.2.67/build/pdf.worker.min.mjs';

const pdfRenderer = {
    numPages: 0,
    pageNum: 0,
    pdf: undefined,
    viewport: undefined,
    filename: '',
    stamps: []
}

let srcStamps = [];
loadSrcStamps();

const loadTab = document.getElementById("loadTab");
const stampTab = document.getElementById("stampTab");
const downloadTab = document.getElementById("downloadTab");
downloadTab.addEventListener('click', () => {
    generateStampedPdf();
});

const loadSection = document.getElementById("loadSection");
const stampSection = document.getElementById("stampSection");

loadTab.addEventListener("click", () => {
    showSection(loadSection);
    setActiveTab(loadTab);
});

stampTab.addEventListener("click", () => {
    showSection(stampSection);
    setActiveTab(stampTab);
});


function showSection(section) {
    loadSection.classList.remove("active");
    stampSection.classList.remove("active");
    section.classList.add("active");
}

function setActiveTab(activeTab) {
    loadTab.classList.remove("active");
    stampTab.classList.remove("active");
    activeTab.classList.add("active");
}


const pageBox = document.getElementById('pageBox');
const pdfNav = document.getElementById('pdfNav');
const prevPage = document.getElementById('prevPage');
prevPage.addEventListener('click', () => {
    handlePageNum(pdfRenderer.pageNum - 1)
});
const nextPage = document.getElementById('nextPage');
nextPage.addEventListener('click', () => {
    handlePageNum(pdfRenderer.pageNum + 1)
});
const pageNum = document.getElementById('pageNum');
pageNum.addEventListener('change', () => {
    handlePageNum(parseInt(pageNum.value))
});

const numPages = document.getElementById('numPages');

const fileInput = document.getElementById('fileInput');
fileInput.addEventListener('change', handleFileInputChange);
fileInput.addEventListener('paste', handleFilePaste);

const urlInput = document.getElementById('urlInput');
urlInput.value = 'https://pdfobject.com/pdf/sample.pdf';

const btnLoad = document.getElementById('loadURL');
btnLoad.addEventListener('click', () => {
    fileInput.value = '';
    if (fileInput.files) {
        fileInput.files = null;
    }
    pdfRenderer.filename = pdfjsLib.getPdfFilenameFromUrl(urlInput.value)
    loadPdf(urlInput.value);
});

const padCanvas = document.getElementById('padCanvas');
const signaturePad = new SignaturePad(padCanvas);
const padClear = document.getElementById('padClear');
padClear.addEventListener('click', () => {
    signaturePad.clear();
});
const padStampAdd = document.getElementById('padStampAdd');
padStampAdd.addEventListener('click', () => {
    addSrcStamp(
        {
            width: padCanvas.width,
            height: padCanvas.height,
            url: signaturePad.toDataURL()
        }
    );
    signaturePad.clear();
});

function renderSrcStampsPreview() {
    const srcStampsPreview = document.getElementById('srcStampsPreview');
    srcStampsPreview.innerHTML = '';
    const btnAdd = document.createElement('button');
    btnAdd.innerText = 'Add';
    btnAdd.addEventListener('click', handleAddSrcStamp);
    srcStampsPreview.append(btnAdd);

    srcStamps.forEach(s => {
        const stamp = document.createElement('div');
        stamp.style.backgroundImage = `url(${s.url})`;
        srcStampsPreview.append(stamp);
        stamp.addEventListener('click', () => addStamp(s));
        const remove = document.createElement('button');
        remove.innerText = 'X';
        stamp.append(remove);
        remove.addEventListener('click', (event) => {
            event.stopImmediatePropagation();
            const index = srcStamps.indexOf(s);
            srcStamps.splice(index, 1);
            renderSrcStampsPreview();
            saveSrcStamps();
        })
    })
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
                const srcStamp = {
                    width: img.width,
                    height: img.height,
                    url: reader.result
                };
                addSrcStamp(srcStamp);
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(files[0]);
    });
    input.click();
}

function addSrcStamp(srcStamp) {
    srcStamps.push(srcStamp);
    renderSrcStampsPreview();
    saveSrcStamps();
}

function loadSrcStamps() {
    const srcStampsStr = localStorage.getItem(SRC_STAMPS_LOCAL_STORAGE_KEY);
    if (srcStampsStr) {
        srcStamps = JSON.parse(srcStampsStr);
    } else {
        srcStamps = [];
    }
    renderSrcStampsPreview();
}

function saveSrcStamps() {
    localStorage.setItem(SRC_STAMPS_LOCAL_STORAGE_KEY, JSON.stringify(srcStamps));
}

function handleFilePaste(event) {
    const files = event.clipboardData.files;
    handleFiles(files);
}

function handleFileInputChange(event) {
    const files = event.target.files;
    handleFiles(files);
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
    // TODO limits
    renderPage(num);
}

async function loadPdf(src) {
    pdfRenderer.pdf = await pdfjsLib.getDocument(src).promise;
    console.debug('PDF loaded');
    const metadata = await pdfRenderer.pdf.getMetadata();
    console.debug('Metadata loaded', metadata);
    numPages.innerText = pdfRenderer.pdf.numPages;
    pageNum.setAttribute('max', pdfRenderer.pdf.numPages);
    pdfRenderer.numPages = pdfRenderer.pdf.numPages;
    pdfRenderer.stamps = [];
    renderPage(1);
    setActiveTab(stampTab);
    showSection(stampSection);
}

async function renderPage(pageNumber) {
    pageNum.value = pageNumber;
    pdfRenderer.pageNum = pageNumber;
    prevPage.disabled = pageNumber === 1;
    nextPage.disabled = pageNumber === pdfRenderer.numPages;
    pageBox.innerHTML = '';
    const page = await pdfRenderer.pdf.getPage(pageNumber);
    console.debug('Page loaded');
    const scale = 1.0;
    const viewport = page.getViewport({ scale: scale });
    pdfRenderer.viewport = viewport;
    const canvas = document.createElement('canvas');
    pageBox.append(canvas);
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    pageBox.style.width = `${viewport.width}px`;
    pageBox.style.height = `${viewport.height}px`;
    // Render PDF page into canvas context
    const renderContext = {
        canvasContext: context,
        viewport: viewport
    };
    await page.render(renderContext).promise;
    console.debug('Page rendered');
    renderStamps();
}

function renderStamps() {
    pdfRenderer.stamps.forEach(s => {
        if (s.startPage > pdfRenderer.pageNum) {
            return;
        }
        if (s.repeatPage > 0 && (pdfRenderer.pageNum - s.startPage) % s.repeatPage !== 0) {
            return;
        }
        if (s.repeatPage === 0 && s.startPage !== pdfRenderer.pageNum) {
            return;
        }
        const div = document.createElement('div');
        div.classList.add('stamp');
        const img = document.createElement('img');
        img.src = s.url;
        img.style.opacity = s.opacity;
        div.style.width = `${s.width}px`;
        div.style.height = `${s.height}px`;
        div.style.transform = `translate(${s.x}px, ${s.y}px)`;
        div._stamp = s;
        div.append(img)
        const topleft = document.createElement('div');
        topleft.classList.add('corner', 'top-left')
        div.append(topleft);
        const topright = document.createElement('div');
        topright.classList.add('corner', 'top-right')
        div.append(topright);
        const bottomleft = document.createElement('div');
        bottomleft.classList.add('corner', 'bottom-left')
        div.append(bottomleft);
        const bottomright = document.createElement('div');
        bottomright.classList.add('corner', 'bottom-right')
        div.append(bottomright);
        const actionBar = document.createElement('div');
        actionBar.classList.add('action-bar');
        div.append(actionBar);
        const inputRepeat = document.createElement('input');
        inputRepeat.type = 'number';
        inputRepeat.value = s.repeatPage;
        inputRepeat.min = 0;
        inputRepeat.classList.add('repeat');
        inputRepeat.addEventListener('change', (event) => {
            s.repeatPage = parseInt(event.target.value);
        })
        actionBar.append(inputRepeat);
        const inputOpacity = document.createElement('input');
        inputOpacity.type = 'number';
        inputOpacity.min = 0;
        inputOpacity.max = 1;
        inputOpacity.step = 0.05;
        inputOpacity.value = s.opacity;
        inputOpacity.classList.add('opacity');
        inputOpacity.addEventListener('change', (event) => {
            s.opacity = parseFloat(event.target.value);
            img.style.opacity = s.opacity;
        })
        actionBar.append(inputOpacity);

        const btnRemove = document.createElement('button');
        btnRemove.innerText = 'X';
        btnRemove.classList.add('remove');
        actionBar.append(btnRemove);
        btnRemove.addEventListener('click', (event) => {
            event.stopImmediatePropagation();
            const index = pdfRenderer.stamps.indexOf(s);
            pdfRenderer.stamps.splice(index, 1);
            div.remove();
        })
        pageBox.append(div);
    })
}

function addStamp(srcStamp) {
    const scaleX = pdfRenderer.viewport.width / srcStamp.width;
    const scaleY = pdfRenderer.viewport.height / srcStamp.height;
    const scale = Math.min(scaleX, scaleY, 1.0);

    pdfRenderer.stamps.push({
        x: 0,
        y: 0,
        width: srcStamp.width * scale,
        height: srcStamp.height * scale,
        opacity: 1.0,
        startPage: pdfRenderer.pageNum,
        repeatPage: 0,
        url: srcStamp.url
    });
    renderPage(pdfRenderer.pageNum);
}

async function generateStampedPdf() {
    const pdfDoc = await PDFLib.PDFDocument.load(await pdfRenderer.pdf.getData());

    for (const stamp of pdfRenderer.stamps) {
        // TODO test if can reuse image for same stampSrc
        const image = await pdfDoc.embedPng(stamp.url);
        for (let i = stamp.startPage - 1; i < pdfRenderer.numPages; i += stamp.repeatPage > 0 ? stamp.repeatPage : pdfRenderer.numPages) {
            // 0 indexex
            const page = pdfDoc.getPage(i);

            // Convert coordinates from web (viewport) to PDF reference
            const pdfX = stamp.x;
            const pdfY = pdfRenderer.viewport.height - stamp.y - stamp.height;
            const pdfWidth = stamp.width;
            const pdfHeight = stamp.height;

            // Draw the image on the PDF page at the converted coordinates
            page.drawImage(image, {
                x: pdfX,
                y: pdfY,
                width: pdfWidth,
                height: pdfHeight,
                opacity: stamp.opacity,
                // TODO: blendMode use cases?
            });

            // does not work for some pdfs with white backgrounds in text
            // using opacity does work for text
            const drawBehind = false;
            if (drawBehind) {
                const contents = page.node.normalizedEntries().Contents;
                const newContentsRef = contents.get(contents.size() - 1);
                contents.remove(contents.size() - 1);
                contents.insert(0, newContentsRef);
            }

        }
    }

    // Save the modified PDF
    const pdfBytesWithWatermark = await pdfDoc.save();

    // Create a Blob from the PDF bytes and create an object URL
    const blob = new Blob([pdfBytesWithWatermark], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    // Create a link to download the watermarked PDF
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = pdfRenderer.filename.replace('.pdf', '-stamped.pdf');
    document.body.append(downloadLink);
    downloadLink.click();

    // Clean up the object URL
    URL.revokeObjectURL(url);
    downloadLink.remove();
}

interact('.stamp')
    .draggable({
        listeners: {
            move: function (event) {
                const { target } = event;
                const x = target._stamp.x + event.dx;
                const y = target._stamp.y + event.dy;
                target.style.transform = `translate(${x}px, ${y}px)`;
                target._stamp.x = x;
                target._stamp.y = y;
            },
        },
        modifiers: [
            interact.modifiers.restrictRect({
                restriction: 'parent',
                endOnly: false
            })
        ]
    })
    .resizable({
        // resize from all edges and corners
        edges: { left: true, right: true, bottom: true, top: true },
        listeners: {
            move(event) {
                const { target } = event;
                let { width, height } = event.rect;

                target.style.width = `${width}px`;
                target.style.height = `${height}px`;

                const x = target._stamp.x + event.deltaRect.left;
                const y = target._stamp.y + event.deltaRect.top;

                target.style.transform = `translate(${x}px, ${y}px)`;

                target._stamp.x = x;
                target._stamp.y = y;
                target._stamp.width = width;
                target._stamp.height = height;
            }
        },
        modifiers: [
            interact.modifiers.restrictEdges({
                outer: 'parent',
            }),
            interact.modifiers.restrictSize({
                min: { width: 50, height: 50 },
            })
        ]
    });
