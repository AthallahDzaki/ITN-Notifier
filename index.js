require("dotenv").config();
const axios = require("axios");
const imageToBase64 = require('image-to-base64');
const fs = require("fs");
const puppeteer = require("puppeteer");

const WHURL = process.env.WebhookURL; // Main


let g_Cookies = "";

async function GetData(username)
{
    return new Promise(async (resolve, reject) => {
        if(!g_Cookies)
        {
            throw new Error("Please Login First");
        }
        axios.get("https://www.instagram.com/api/v1/users/web_profile_info/?username="+username, {
            headers: {
                'cookie': g_Cookies,
                'user-agent': "Mozilla/5.0 (Linux; Android 10; SM-A107F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.105 Mobile Safari/537.36",
                'X-Ig-App-Id': "1217981644879628",
                ["sec-fetch-site"]: "same-origin"
            },
        }).then(async res => {
            let json = res.data;
            const items = json?.data?.user?.edge_owner_to_timeline_media?.edges || [];
            const filteredItems = items?.filter((el, index) => { return !4 ? el : index < 4 });
            const mappedItems = await Promise.all(filteredItems?.map(async (el) => {
                const imageBody = false ? await imageToBase64(el?.['node']?.['display_url']) : false;
                const image = imageBody || false;
                let obj = {
                    id: el?.['node']?.['id'],
                    time: el?.['node']?.['taken_at_timestamp'],
                    imageUrl: el?.['node']?.['display_url'],
                    likes: el?.['node']?.['edge_liked_by']?.['count'],
                    comments: el?.['node']?.['edge_media_to_comment']?.['count'],
                    link: 'https://www.instagram.com/p/' + el?.['node']?.['shortcode'] + '/',
                    text: el?.['node']?.['edge_media_to_caption']?.['edges']?.[0]?.['node']?.['text']
                }

                const location = el?.['node']?.['location']?.['name'];
                if (location) obj.location = location;

                const carouselNodes = el?.['node']?.['edge_sidecar_to_children']?.['edges'];
                if (carouselNodes?.length) {
                    let carouselData = [];
                    for(let i = 0; i < carouselNodes.length; i++)
                    {
                        let obj = { imageUrl: carouselNodes[i]?.['node']?.['display_url'] }
                        if(true) obj.image = await imageToBase64(carouselNodes[i]?.['node']?.['display_url']);
                        carouselData.push(obj);
                    }
                    obj.carousel = carouselData;
                }

                if (image) obj.image = image

                if (
                    el?.['node']?.['is_video'] &&
                    el?.['node']?.['video_url']
                ) {
                    obj.videoUrl = el?.['node']?.['video_url'];
                    obj.videoViewCount = el?.['node']?.['video_view_count'];
                    if (true) obj.video = await imageToBase64(el?.['node']?.['video_url']);
                }

                return obj

            }));
            resolve(mappedItems);
        }).catch(err => {
            reject(err);
        });
    })
}

async function LoginToRealDevice()
{
    /* How This Work?
    1. Run Browser with puppeteer-core
    2. Open https://www.instagram.com/
    3. Login with your account
    4. Wait Page Fully Loaded
    4. Get Header Cookies from /timeline/ path
    5. Return Cookies as plain text and used at GetData Function
    */
    let browser = await puppeteer.launch({
        headless: "new",
    })
    let page = await browser.newPage();
    await page.goto("https://www.instagram.com/");
    await page.waitForSelector('input[name=username]');
    //await page.$eval('input[name=username]', el => el.value = 'rekayasa.perangkat.lembek');
    await page.type('input[name=username]', process.env.IG_USERNAME);
    await page.type('input[name=password]', process.env.IG_PASSWORD);
    await page.click('button[type=submit]');
    await page.waitForNavigation();
    if(await page.url() == "https://www.instagram.com/accounts/onetap/?next=%2F")
    {
        await page.click("div[role=button]");
        await page.waitForNavigation();
    }
    let cookie = await page.cookies("https://www.instagram.com/timeline/");
    let cookieStr = "";
    for(let i = 0; i < cookie.length; i++)
    {
        cookieStr += `${cookie[i].name}=${cookie[i].value.replaceAll("\\", "\/")}; `;
    }
    await browser.close();
    return cookieStr;
}

(async () => {
    g_Cookies = await LoginToRealDevice();
    await GetFTIContent().then(async (res) => {
        console.log("FTI : ", res);
    }).catch((err) => {
        console.log("FTI ERR: " + err);
    })
    await GetINewsContent().then(async (res) => {
        console.log("INEWS : ", res);
    }).catch((err) => {
        console.log("INEWS ERR: " + err);
    })
})();

async function GetFTIContent()
{
    return new Promise(async (resolve, reject) => {
        let ret = await GetData("informatika.itn");

        if(fs.readFileSync("latest_id_FTI.txt", "utf-8") != ret[3].id)
        {
            console.log("New Post Detected at FTI - Institut Teknologi Nasional Malang");
            //fs.writeFileSync("latest_id.txt", ret[3].id);
            let field = [{
                "name": "Likes",
                "value": `${ret[3].likes}`,
                "inline": true
            },
            {
                "name": "Comments",
                "value": `${ret[3].comments}`,
                "inline": true
            }];
    
            if(typeof( ret[3]?.location) != "undefined")
            {
                field.push({
                    "name": "Location",
                    "value": `${ret[3].location}`,
                    "inline": true
                });
            }
    
            if(typeof( ret[3]?.videoUrl ) != "undefined")
            {
                field.push({
                    "name": "Video",
                    "value": `Video is Under This Message`,
                    "inline": true
                });
            }
    
            field.push({
                "name": "Date",
                "value": `${new Date(ret[3].time * 1000)}`,
                "inline": true
            })
    
            let post = {
                "username": "FTI - Institut Teknologi Nasional Malang",
                "avatar_url": "https://instagram.fsub8-2.fna.fbcdn.net/v/t51.2885-19/365146966_1260129631148068_5489059564946239368_n.jpg?stp=dst-jpg_s320x320&_nc_ht=instagram.fsub8-2.fna.fbcdn.net&_nc_cat=104&_nc_ohc=pbDnmiruy9UAX9_omyG&edm=AOQ1c0wBAAAA&ccb=7-5&oh=00_AfD6zmUKOrVcRPQfeXMjLgmytEapQZ2sur4Rmri0b-hInA&oe=64DD8599&_nc_sid=8b3546",
                "content": `New Content From FTI - Institut Teknologi Nasional Malang`,
                "embeds": [
                  {
                    "title": "Fakultas Teknik Informatika",
                    "url": `${ret[3].link}`,
                    "description": `${ret[3].text}`,
                    "color": 15258703,
                    "fields": field,
                    "thumbnail": {
                      "url": "https://upload.wikimedia.org/wikipedia/commons/3/38/4-Nature-Wallpapers-2014-1_ukaavUI.jpg"
                    },
                    "footer": {
                      "text": "Woah! So cool! 😲",
                      "icon_url": "https://i.imgur.com/fKL31aD.jpg"
                    }
                  }
                ]
            };
    
            if(typeof(ret[3]?.imageUrl) != "undefined" && typeof(ret[3]?.carousel) == "undefined")
            {
                post.embeds[0].image = {
                    "url": `${ret[3].imageUrl}`
                };
            }
            else if(typeof(ret[3]?.carousel) != "undefined")
            {
                post.embeds[0].fields.push({
                    "name": "Carousel",
                    "value": `Carousel is Under This Message`,
                    "inline": true
                });
            }
    
            axios.post(WHURL, post).catch((err) => {
                reject(err);
            });
    
            if(typeof(ret[3]?.videoUrl) != "undefined")
            {
                const buffer = Buffer.from(ret[3]?.video, 'base64');
                const FormData = require('form-data');
                const form = new FormData;
    
                form.append('username', "FTI - Institut Teknologi Nasional Malang");
    
                form.append('avatar_url', "https://instagram.fsub8-2.fna.fbcdn.net/v/t51.2885-19/365146966_1260129631148068_5489059564946239368_n.jpg?stp=dst-jpg_s320x320&_nc_ht=instagram.fsub8-2.fna.fbcdn.net&_nc_cat=104&_nc_ohc=pbDnmiruy9UAX9_omyG&edm=AOQ1c0wBAAAA&ccb=7-5&oh=00_AfD6zmUKOrVcRPQfeXMjLgmytEapQZ2sur4Rmri0b-hInA&oe=64DD8599&_nc_sid=8b3546");
    
                form.append('upload', buffer, ret[3].id+".mp4");
                
                form.submit(WHURL, (error, response) => {
                    
                    if (error) reject(error);
                    if (response) 
                    {
                        console.log("Uploaded MP4 Because Have a Video");
                        fs.writeSync(fs.openSync("latest_id_FTI.txt", "w"), ret[3].id);
                        resolve("ALL Process Done");
                    }
                });
            }
            else
            {
                if(typeof(ret[3]?.carousel) != "undefined")
                {
                    for(let i = 0; i < ret[3]?.carousel.length; i++)
                    {
                        console.log(ret[3]?.carousel[i].image);
                        const buffer = Buffer.from(ret[3]?.carousel[i].image, 'base64');
                        const FormData = require('form-data');
                        const form = new FormData;

                        form.append('username', "ITN Malang News");

                        form.append('avatar_url', "https://scontent-xsp1-1.cdninstagram.com/v/t51.2885-19/56649586_593617321153064_8169530956705693696_n.jpg?stp=dst-jpg_s320x320&_nc_ht=scontent-xsp1-1.cdninstagram.com&_nc_cat=108&_nc_ohc=Rxdzav8QwOsAX8knDqS&edm=AOQ1c0wBAAAA&ccb=7-5&cb_e2o_trans=t&oh=00_AfCK5sOIN9f1A4yp76Xhck4ThU1r_m9yPHhdvCgp8dpMMA&oe=64DCD642&_nc_sid=8b3546");

                        form.append('upload', buffer, ret[3].id +"_"+ i +".jpg");
                        
                        form.submit(WHURL, (error, response) => {
                            
                            if (error) reject(error);
                            if (response) 
                            {
                                console.log("Uploaded Carousel "+i+" Because Have a Carousel Length");
                            }
                        });
                    }
                }
                fs.writeSync(fs.openSync("latest_id_FTI.txt", "w"), ret[3].id);
                resolve("ALL Process Done");
            }
            //PostToDiscord(...);
        }
        else
        {
            reject("No New Post Detected at FTI - Institut Teknologi Nasional Malang");
        }
    });
}

async function GetINewsContent()
{
    return new Promise(async (resolve, reject) => {
        ret = await GetData("itnmalang_news");

        if(fs.readFileSync("latest_id_INEWS.txt", "utf-8") != ret[3].id)
        {
            console.log("New Post Detected at ITN Malang News");
            //fs.writeFileSync("latest_id.txt", ret[3].id);
            let field = [{
                "name": "Likes",
                "value": `${ret[3].likes}`,
                "inline": true
            },
            {
                "name": "Comments",
                "value": `${ret[3].comments}`,
                "inline": true
            }];

            if(typeof( ret[3]?.location) != "undefined")
            {
                field.push({
                    "name": "Location",
                    "value": `${ret[3].location}`,
                    "inline": true
                });
            }

            if(typeof( ret[3]?.videoUrl ) != "undefined")
            {
                field.push({
                    "name": "Video",
                    "value": `Video is Under This Message`,
                    "inline": true
                });
            }

            field.push({
                "name": "Date",
                "value": `${new Date(ret[3].time * 1000)}`,
                "inline": true
            })

            let post = {
                "username": "ITN Malang News",
                "avatar_url": "https://scontent-xsp1-1.cdninstagram.com/v/t51.2885-19/56649586_593617321153064_8169530956705693696_n.jpg?stp=dst-jpg_s320x320&_nc_ht=scontent-xsp1-1.cdninstagram.com&_nc_cat=108&_nc_ohc=Rxdzav8QwOsAX8knDqS&edm=AOQ1c0wBAAAA&ccb=7-5&cb_e2o_trans=t&oh=00_AfCK5sOIN9f1A4yp76Xhck4ThU1r_m9yPHhdvCgp8dpMMA&oe=64DCD642&_nc_sid=8b3546",
                "content": `New Content From ITN Malang News`,
                "embeds": [
                {
                    "title": "ITN Malang News",
                    "url": `${ret[3].link}`,
                    "description": `${ret[3].text}`,
                    "color": 15258703,
                    "fields": field,
                    "thumbnail": {
                    "url": "https://upload.wikimedia.org/wikipedia/commons/3/38/4-Nature-Wallpapers-2014-1_ukaavUI.jpg"
                    },
                    "footer": {
                    "text": "Woah! So cool! 😲",
                    "icon_url": "https://i.imgur.com/fKL31aD.jpg"
                    }
                }
                ]
            };

            if(typeof(ret[3]?.imageUrl) != "undefined" && typeof(ret[3]?.carousel) == "undefined")
            {
                post.embeds[0].image = {
                    "url": `${ret[3].imageUrl}`
                };
            }
            else if(typeof(ret[3]?.carousel) != "undefined")
            {
                post.embeds[0].fields.push({
                    "name": "Carousel",
                    "value": `Carousel is Under This Message`,
                    "inline": true
                });
            }

            axios.post(WHURL, post).catch((err) => {
                reject(err);
            });

            if(typeof(ret[3]?.carousel) != "undefined")
            {
                for(let i = 0; i < ret[3]?.carousel.length; i++)
                {
                    console.log(ret[3]?.carousel[i].image);
                    const buffer = Buffer.from(ret[3]?.carousel[i].image, 'base64');
                    const FormData = require('form-data');
                    const form = new FormData;

                    form.append('username', "ITN Malang News");

                    form.append('avatar_url', "https://scontent-xsp1-1.cdninstagram.com/v/t51.2885-19/56649586_593617321153064_8169530956705693696_n.jpg?stp=dst-jpg_s320x320&_nc_ht=scontent-xsp1-1.cdninstagram.com&_nc_cat=108&_nc_ohc=Rxdzav8QwOsAX8knDqS&edm=AOQ1c0wBAAAA&ccb=7-5&cb_e2o_trans=t&oh=00_AfCK5sOIN9f1A4yp76Xhck4ThU1r_m9yPHhdvCgp8dpMMA&oe=64DCD642&_nc_sid=8b3546");

                    form.append('upload', buffer, ret[3].id +"_"+ i +".jpg");
                    
                    form.submit(WHURL, (error, response) => {
                        
                        if (error) reject(error);
                        if (response) 
                        {
                            console.log("Uploaded Carousel "+i+" Because Have a Carousel Length");
                        }
                    });
                }
            }

            if(typeof(ret[3]?.videoUrl) != "undefined")
            {
                const buffer = Buffer.from(ret[3]?.video, 'base64');
                const FormData = require('form-data');
                const form = new FormData;

                form.append('username', "ITN Malang News");

                form.append('avatar_url', "https://scontent-xsp1-1.cdninstagram.com/v/t51.2885-19/56649586_593617321153064_8169530956705693696_n.jpg?stp=dst-jpg_s320x320&_nc_ht=scontent-xsp1-1.cdninstagram.com&_nc_cat=108&_nc_ohc=Rxdzav8QwOsAX8knDqS&edm=AOQ1c0wBAAAA&ccb=7-5&cb_e2o_trans=t&oh=00_AfCK5sOIN9f1A4yp76Xhck4ThU1r_m9yPHhdvCgp8dpMMA&oe=64DCD642&_nc_sid=8b3546");

                form.append('upload', buffer, ret[3].id+".mp4");
                
                form.submit(WHURL, (error, response) => {
                    
                    if (error) reject(error);
                    if (response) 
                    {
                        console.log("Uploaded MP4 Because Have a Video");
                        fs.writeSync(fs.openSync("latest_id_INEWS.txt", "w"), ret[3].id);
                        resolve("ALL Process Done");
                    }
                });
            }
            else
            {
                if(typeof(ret[3]?.carousel) != "undefined")
                {
                    for(let i = 0; i < ret[3]?.carousel.length; i++)
                    {
                        console.log(ret[3]?.carousel[i].image);
                        const buffer = Buffer.from(ret[3]?.carousel[i].image, 'base64');
                        const FormData = require('form-data');
                        const form = new FormData;

                        form.append('username', "ITN Malang News");

                        form.append('avatar_url', "https://scontent-xsp1-1.cdninstagram.com/v/t51.2885-19/56649586_593617321153064_8169530956705693696_n.jpg?stp=dst-jpg_s320x320&_nc_ht=scontent-xsp1-1.cdninstagram.com&_nc_cat=108&_nc_ohc=Rxdzav8QwOsAX8knDqS&edm=AOQ1c0wBAAAA&ccb=7-5&cb_e2o_trans=t&oh=00_AfCK5sOIN9f1A4yp76Xhck4ThU1r_m9yPHhdvCgp8dpMMA&oe=64DCD642&_nc_sid=8b3546");

                        form.append('upload', buffer, ret[3].id +"_"+ i +".jpg");
                        
                        form.submit(WHURL, (error, response) => {
                            
                            if (error) reject(error);
                            if (response) 
                            {
                                console.log("Uploaded Carousel "+i+" Because Have a Carousel Length");
                            }
                        });
                    }
                }
                fs.writeSync(fs.openSync("latest_id_INEWS.txt", "w"), ret[3].id);
                resolve("ALL Process Done");
            }
        }
        else
        {
            reject("No New Post Detected at ITN Malang News");
        }
    });
}