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
const downloadTab = document.getElementById("downloadTab");
downloadTab.addEventListener('click', () => {
    generateStampedPdf();
});

const loadSection = document.getElementById("loadSection");
const stampSection = document.getElementById("stampSection");
const dialog = document.getElementById('signature-dialog');
const colorPicker = document.getElementById('color-picker');
colorPicker.addEventListener('input', (event) => {
    signaturePad.penColor = event.target.value;
  });

loadTab.addEventListener("click", () => {
    showSection(loadSection);
    setActiveTab(loadTab);
});

function showSection(section) {
    loadSection.classList.remove("active");
    stampSection.classList.remove("active");
    section.classList.add("active");
}

function setActiveTab(activeTab) {
    loadTab.classList.remove("active");
    if (activeTab) {
        activeTab.classList.add("active");
        downloadTab.disabled = true;
    }
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
urlInput.value = ''; //demo: https://pdfobject.com/pdf/sample.pdf, https://ontheline.trincoll.edu/images/bookdown/sample-local-pdf.pdf

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
const padClose = document.getElementById('padClose');
padClose.addEventListener('click', () => {
    dialog.close();
});

padClear.addEventListener('click', () => {
    signaturePad.clear();
});
const padStampAdd = document.getElementById('padStampAdd');
padStampAdd.addEventListener('click', () => {
    if(!signaturePad.isEmpty()){
        addSrcStamp(
            {
                width: padCanvas.width,
                height: padCanvas.height,
                url: signaturePad.toDataURL()
            }
        );
    }
    signaturePad.clear();
    dialog.close();
});


const loadImage = document.getElementById('loadImage');
loadImage.addEventListener('click', handleAddSrcStamp);

function renderSrcStampsPreview() {
    const srcStampsPreview = document.getElementById('srcStampsPreview');
    srcStampsPreview.innerHTML = '';
    const btnAdd = document.createElement('button');
    btnAdd.innerText = 'Add'
    btnAdd.id = 'addSrcStamp';
    btnAdd.addEventListener('click', () => {
        showDialog();
    });
    srcStampsPreview.append(btnAdd);

    srcStamps.forEach(s => {
        const stamp = document.createElement('div');
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
    showSection(stampSection);
    setActiveTab(null);
    if(srcStamps.length === 0){
        showDialog();
    }
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
    pdfRenderer.stampCanvas = new fabric.Canvas(pdfRenderer.canvas);
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
    resizePageBox();
    renderPdfNav();
    renderDownloadTab();
}

function renderPdfNav() {
    if (pdfRenderer.numPages > 1) {
        pdfNav.style.display = 'flex';
    } else {
        pdfNav.style.display = 'none';
    }
}

function renderDownloadTab() {
    if (pdfRenderer.stamps.length > 0) {
        downloadTab.disabled = false;
    } else {
        downloadTab.disabled = true;
    }
}


function updateStamp(stamp, img, div) {
    stamp.x = img.left;
    stamp.y = img.top;
    stamp.scaleX = img.scaleX;
    stamp.scaleY = img.scaleY;
    stamp.angle = img.angle;
    div.style.width = `${stamp.width * stamp.scaleX}px`;
    const topLeftX = stamp.x;
    const topLeftY = stamp.y;
    const height = (stamp.height + 20 ) * stamp.scaleY;
    const angle = -stamp.angle;
    const radians = angle * (Math.PI / 180);
    const bottomLeftX = topLeftX + height * Math.sin(radians);
    const bottomLeftY = topLeftY + height * Math.cos(radians);
    div.style.transform = `translate(${bottomLeftX}px, ${bottomLeftY}px)`;

}

function renderStamps() {
    let stampCanvas = document.createElement('canvas');
    stampCanvas.height = pdfRenderer.viewport.height;
    stampCanvas.width = pdfRenderer.viewport.width;
    pageBox.append(stampCanvas);
    stampCanvas = new fabric.Canvas(stampCanvas);
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

        fabric.Image.fromURL(s.url, (img, err) => {
            const div = document.createElement('div');
            div.classList.add('stamp');

            img.on('moving', function () { updateStamp(s, img, div); });
            img.on('scaling', function () { updateStamp(s, img, div); });
            img.on('rotating', function () { updateStamp(s, img, div); });
            img.on('selected', function () { div.style.display = 'block'; });
            img.on('deselected', function () { div.style.display = 'none'; });
            stampCanvas.add(img);
            div.style.display = 'none';
            div.style.width = `${s.width * s.scaleX}px`;
            div.style.transform = `translate(${s.x}px, ${s.y + (s.height * s.scaleY)}px)`;
            div._stamp = s;
            const actionBar = document.createElement('div');
            actionBar.classList.add('action-bar');
            div.append(actionBar);
            const inputRepeat = document.createElement('input');
            inputRepeat.classList.add('repeat');
            inputRepeat.type = 'number';
            inputRepeat.value = s.repeatPage;
            inputRepeat.min = 0;
            inputRepeat.classList.add('repeat');
            inputRepeat.addEventListener('change', (event) => {
                s.repeatPage = parseInt(event.target.value);
            })
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
            })

            const inputOpacityLabel = document.createElement('label');
            inputOpacityLabel.innerText = 'Opacity';
            inputOpacityLabel.append(inputOpacity);
            actionBar.append(inputOpacityLabel);

            const btnRemove = document.createElement('button');
            btnRemove.innerText = 'X';
            btnRemove.classList.add('remove');
            actionBar.append(btnRemove);
            btnRemove.addEventListener('click', (event) => {
                event.stopImmediatePropagation();
                const index = pdfRenderer.stamps.indexOf(s);
                pdfRenderer.stamps.splice(index, 1);
                div.remove();
                stampCanvas.remove(img);
                stampCanvas.requestRenderAll();
            })
            pageBox.append(div);


        }, {
            left: s.x,
            top: s.y,
            opacity: s.opacity,
            scaleX: s.scaleX,
            scaleY: s.scaleY,
            angle: s.angle,
        });
    })
}

function addStamp(srcStamp) {
    const scaleX = pdfRenderer.viewport.width / srcStamp.width;
    const scaleY = pdfRenderer.viewport.height / srcStamp.height;
    const scale = Math.min(scaleX, scaleY, 1.0);

    pdfRenderer.stamps.push({
        x: 0,
        y: 0,
        width: srcStamp.width,
        height: srcStamp.height,
        scaleX: scale,
        scaleY: scale,
        opacity: 1.0,
        angle: 0,
        startPage: pdfRenderer.pageNum,
        repeatPage: 0,
        url: srcStamp.url
    });
    renderPage(pdfRenderer.pageNum);
}

function toRadians(degree) {
    return degree * (Math.PI / 180);
};

async function generateStampedPdf() {
    const pdfDoc = await PDFLib.PDFDocument.load(await pdfRenderer.pdf.getData());

    for (const stamp of pdfRenderer.stamps) {
        // TODO test if can reuse image for same stampSrc
        const image = await pdfDoc.embedPng(stamp.url);
        for (let i = stamp.startPage - 1; i < pdfRenderer.numPages; i += stamp.repeatPage > 0 ? stamp.repeatPage : pdfRenderer.numPages) {
            // 0 indexex
            const page = pdfDoc.getPage(i);

            // Convert coordinates from web (viewport) to PDF reference
            const pdfWidth = stamp.width * stamp.scaleX;
            const pdfHeight = stamp.height * stamp.scaleY;
            const pdfX = stamp.x;
            const pdfY = pdfRenderer.viewport.height - stamp.y - pdfHeight;

            let originX = pdfX;
            let originY = pdfY + pdfHeight;
            let angle = toRadians(-stamp.angle);

            page.pushOperators(
                PDFLib.pushGraphicsState(),
                PDFLib.concatTransformationMatrix(
                    1,
                    0,
                    0,
                    1,
                    originX,
                    originY,
                ),
                PDFLib.concatTransformationMatrix(
                    Math.cos(angle),
                    Math.sin(angle),
                    -Math.sin(angle),
                    Math.cos(angle),
                    0,
                    0,
                ),
                PDFLib.concatTransformationMatrix(
                    1,
                    0,
                    0,
                    1,
                    -1 * originX,
                    -1 * originY,
                ),
            );

            // Draw the image on the PDF page at the converted coordinates
            page.drawImage(image, {
                x: pdfX,
                y: pdfY,
                width: pdfWidth,
                height: pdfHeight,
                opacity: stamp.opacity,
                // TODO: blendMode use cases?
            });
            page.pushOperators(
                PDFLib.popGraphicsState(),
            );
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

// fit on mobile
function resizePageBox() {
    const pageBox = document.getElementById('pageBox');
    const viewportWidth = Math.min(window.innerWidth, document.documentElement.clientWidth - 40);
    const pageBoxWidth = pageBox.offsetWidth;

    const ratio = viewportWidth / pageBoxWidth;

    if (ratio < 1) {
        pageBox.style.transform = `scale(${ratio})`;
    } else {
        pageBox.style.transform = 'scale(1)';
    }
}


// Initial call to resizePageBox on page load
resizePageBox();

// Add event listener for window resize
window.addEventListener('resize', resizePageBox, false);
// Ensure canvas is sized correctly
function resizeCanvas() {
    padCanvas.width = padCanvas.offsetWidth;
    padCanvas.height = padCanvas.offsetHeight;
}

resizeCanvas();
