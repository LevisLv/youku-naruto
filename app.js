const fs = require('fs');
const rp = require('request-promise');
const ejs = require('ejs');

// XNTQwMTgxMTE2
const encodevid = 'XNTQwMTgxMTE2';
const end = 720;

const videoMap = new Map();

async function execute(encodevid) {
    return rp({
        method: 'GET',
        uri: `http://v.youku.com/v_show/id_${encodevid}.html`,
        transform2xxOnly: true
    })
        .then(function (body) {
            const videoList = JSON.parse(body.substring(body.indexOf('window.playerAnthology={"list":') + 'window.playerAnthology={"list":'.length, body.indexOf(',"next":{"encodevid":"')));
            videoList.forEach(function (video) {
                videoMap.set(video.seq, video);
            });
            if (parseInt(videoList[videoList.length - 1].seq) < end) {
                return execute(videoList[videoList.length - 1].encodevid);
            }
        });
}

async function getDescription(seq, encodevid) {
    return rp({
        method: 'GET',
        uri: `http://v.youku.com/v_show/id_${encodevid}.html`,
        transform2xxOnly: true
    })
        .then(function (body) {
            const description = body.substring(body.indexOf('视频内容简介:') + '视频内容简介:'.length, body.indexOf('" />\n' +
                '<meta name="irTitle" content="'));
            const video = videoMap.get(seq);
            video.description = description;
            videoMap.set(seq, video);
        });
}

function render() {
    videoMap.forEach(function (video, seq) {
        const index = parseInt(seq);
        const startIndex = (Math.floor(index / 30) - (index % 30 === 0 ? 1 : 0)) * 30 + 1;
        const endIndex = ((Math.floor(index / 30) - (index % 30 === 0 ? 1 : 0)) + 1) * 30;
        const dir1 = `00${startIndex}`.slice(-3) + '-' + `00${endIndex}`.slice(-3);
        if (!fs.existsSync(dir1)) {
            fs.mkdirSync(dir1);
        }
        const dir2 = video.title;
        if (!fs.existsSync(`${dir1}/${dir2}`)) {
            fs.mkdirSync(`${dir1}/${dir2}`);
        }
        ejs.renderFile('b.ejs', {
            prevVideo: index === 1 ? video : videoMap.get(`${index - 1}`),
            video: video,
            nextVideo: index === 720 ? video : videoMap.get(`${index + 1}`)
        }, 'utf8', function (err, str) {
            if (err) {
                console.error(err);
            } else {
                // console.log(str);
                const mdFileName = `${dir1}/${dir2}/index.md`;
                fs.writeFile(mdFileName, str, 'utf8', function (err) {
                    if (err) {
                        console.error(err);
                    }
                });
            }
        });
        if (parseInt(seq) % 30 === 0) {
            ejs.renderFile('a.ejs', {firstSeq: parseInt(seq) - 29, videoMap: videoMap}, 'utf8', function (err, str) {
                if (err) {
                    console.error(err);
                } else {
                    // console.log(str);
                    const mdDirName = `00${parseInt(seq) - 29}`.slice(-3) + '-' + `00${parseInt(seq)}`.slice(-3);
                    if (!fs.existsSync(mdDirName)) {
                        fs.mkdirSync(mdDirName);
                    }
                    const mdFileName = `${mdDirName}/index.md`;
                    fs.writeFile(mdFileName, str, 'utf8', function (err) {
                        if (err) {
                            console.error(err);
                        }
                    });
                }
            });
        }
    });
}

Promise.resolve(execute(encodevid))
    .then(function () {
        const set = new Set();
        videoMap.forEach(function (video, seq) {
            set.add(getDescription(seq, video.encodevid));
        });
        Promise.all(set)
            .then(function (data) {
                videoMap.forEach(function (video) {
                    console.log(video);
                });
                render();
            })
            .catch(function (err) {
                console.error(err);
            });
    })
    .catch(function (err) {
        console.error(err);
    });
