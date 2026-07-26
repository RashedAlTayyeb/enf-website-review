#!/usr/bin/env python3
import json
import os
import re
import ssl
import urllib.request
from datetime import datetime, timezone

CMS_ORIGIN = "https://enf-cms.finehhstaging.com"
API_BASE = f"{CMS_ORIGIN}/api"
ROOT_DIR = "/Users/rashedal-tayyeb/Desktop/ENF"
SSL_CONTEXT = ssl._create_unverified_context()

ENDPOINTS = {
    "sliders": "sliders?populate=*&locale=en",
    "homeWhoWeAre": "home-who-we-are?populate=*&locale=en",
    "homeOurStory": "home-our-story?populate=*&locale=en",
    "interventions": "interventions?populate=*&locale=en",
    "news": "newses?populate=*&sort[0]=slug:desc&locale=en",
    "successStories": "success-stories?populate=*&locale=en",
    "partnerIcons": "home-our-partner-icon?populate=*",
    "whoWeAre": "who-we-ares?populate=*&locale=en",
    "ourStoryTimeline": "our-story-pages?locale=en",
    "banner": "banner?populate=*&locale=en",
    "partnersPage": "our-partners-page?populate=*&locale=en",
    "partnersInstitutional": "partners-institutional-donors?populate=*&locale=en",
    "partnersIndividual": "partners-individual-donors?populate=*&locale=en",
    "partnersSupporters": "partners-supporter?populate=*&locale=en",
    "mediaCenterPage": "media-center-page?populate=*&locale=en",
    "mediaPhotoAlbums": "media-center-photo-albums?populate=*&locale=en",
    "photoAlbums": "photo-albums?populate=*&locale=en",
    "albumVideos": "album-videos?populate=*&locale=en",
    "publications": "publications?populate=*&locale=en",
    "donateNow": "donate-now?locale=en",
    "donateNowContent": "donate-now-content?populate=*&locale=en",
    "donationMethods": "donation-methods?locale=en",
    "donationServices": "donation-services-plu?locale=en",
    "serviceCategories": "service-categories?locale=en",
    "donationEducation": "donation-for-education-program?locale=en",
    "privacy": "privacy-policy?locale=en",
    "terms": "terms-and-condition?locale=en",
    "localization": "english-localization?locale=en&populate=*",
}

SOCIAL_LINKS = [
    {
        "label": "Facebook",
        "url": "http://wwww.facebook.com/EliaNuqulFoundation",
        "icon": "facebook",
    },
    {
        "label": "Twitter",
        "url": "http://www.Twitter.com/Elianuqulfdn",
        "icon": "twitter",
    },
    {
        "label": "YouTube",
        "url": "https://www.youtube.com/user/EliaNuqulFoundation",
        "icon": "youtube",
    },
    {
        "label": "Instagram",
        "url": "https://www.instagram.com/EliaNuqulFoundation/",
        "icon": "instagram",
    },
    {
        "label": "LinkedIn",
        "url": "https://jo.linkedin.com/company/elia-nuqul-foundation",
        "icon": "linkedin",
    },
]

NAV = [
    {"id": "home", "label": "Home", "href": "/index.html"},
    {"id": "who-we-are", "label": "Who We Are", "href": "/pages/who-we-are.html"},
    {"id": "our-story", "label": "Our Story", "href": "/pages/our-story.html"},
    {"id": "what-we-do", "label": "What We Do", "href": "/pages/what-we-do.html"},
    {"id": "partners", "label": "Our Partners", "href": "/pages/partners.html"},
    {"id": "our-impact", "label": "Our Impact", "href": "/pages/our-impact.html"},
    {"id": "media-center", "label": "Media Center", "href": "/pages/media-center.html"},
]


def get(obj, *keys, default=None):
    current = obj
    for key in keys:
        if isinstance(current, dict) and key in current:
            current = current[key]
        else:
            return default
    return current


def cms_url(url=""):
    if not url:
        return ""
    return url if url.startswith("http") else f"{CMS_ORIGIN}{url}"


def img(field):
    return cms_url(get(field, "data", "attributes", "url", default=""))


def plain_text(html=""):
    text = str(html or "")
    text = re.sub(r"<br\s*/?>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = text.replace("&nbsp;", " ")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def maybe_html(value=""):
    return value or ""


def fetch_json(endpoint):
    req = urllib.request.Request(
        f"{API_BASE}/{endpoint}",
        headers={"Accept": "application/json", "User-Agent": "ENF-Rebuild-Script/1.0"},
    )
    with urllib.request.urlopen(req, timeout=30, context=SSL_CONTEXT) as response:
        return json.loads(response.read().decode("utf-8"))


def map_news(items):
    mapped = []
    for item in items or []:
        attrs = item.get("attributes", {})
        if attrs.get("Is_visible") is False:
            continue
        article = maybe_html(attrs.get("Article", ""))
        mapped.append(
            {
                "id": item.get("id"),
                "title": attrs.get("Title", ""),
                "slug": attrs.get("slug", ""),
                "articleHtml": article,
                "excerpt": plain_text(article)[:220],
                "featured": bool(attrs.get("Featured")),
                "showOnHome": bool(attrs.get("visible_homePage")),
                "image": img(attrs.get("featured_image")),
            }
        )
    return mapped


def map_programs(items):
    sorted_items = sorted(items or [], key=lambda x: get(x, "attributes", "sequence", default=0) or 0)
    mapped = []
    for item in sorted_items:
        attrs = item.get("attributes", {})
        article = maybe_html(attrs.get("Article", ""))
        mapped.append(
            {
                "id": item.get("id"),
                "title": attrs.get("Title", ""),
                "slug": attrs.get("slug", ""),
                "articleHtml": article,
                "excerpt": plain_text(article)[:240],
                "buttonText": attrs.get("Button") or "Read more",
                "image": img(attrs.get("feature_image")),
                "featured": bool(attrs.get("Featured")),
            }
        )
    return mapped


def map_who_we_are(items):
    sorted_items = sorted(items or [], key=lambda x: get(x, "attributes", "sequence_no", default=0) or 0)
    mapped = []
    for item in sorted_items:
        attrs = item.get("attributes", {})
        if attrs.get("is_visible") is False:
            continue
        desc = maybe_html(attrs.get("Description", ""))
        mapped.append(
            {
                "id": item.get("id"),
                "sequence": attrs.get("sequence_no", 0),
                "title": attrs.get("Title", ""),
                "slug": attrs.get("slug", ""),
                "descriptionHtml": desc,
                "summary": plain_text(desc)[:260],
                "frontImage": img(attrs.get("Front_image")),
                "backImage": img(attrs.get("Back_image")),
            }
        )
    return mapped


def map_timeline(items):
    mapped = []
    for item in items or []:
        attrs = item.get("attributes", {})
        desc = maybe_html(attrs.get("short_decription", ""))
        mapped.append(
            {
                "year": attrs.get("Year", ""),
                "descriptionHtml": desc,
                "summary": plain_text(desc),
            }
        )
    return sorted(mapped, key=lambda x: int(x.get("year", 0) or 0))


def map_stories(items):
    mapped = []
    for item in items or []:
        attrs = item.get("attributes", {})
        if attrs.get("is_visible") is False:
            continue
        article = maybe_html(attrs.get("Article", ""))
        mapped.append(
            {
                "id": item.get("id"),
                "title": attrs.get("Title", ""),
                "slug": attrs.get("slug", ""),
                "designation": attrs.get("Designation", ""),
                "articleHtml": article,
                "excerpt": plain_text(article)[:220],
                "featured": bool(attrs.get("featured")),
                "image": img(attrs.get("feature_image")),
                "bannerImage": img(attrs.get("Banner_image")),
            }
        )
    return mapped


def map_institutional(items):
    mapped = []
    for item in items or []:
        attrs = item.get("attributes", {})
        if attrs.get("is_visible") is False:
            continue
        mapped.append(
            {
                "id": item.get("id"),
                "name": attrs.get("title", ""),
                "core": bool(attrs.get("Our_Core")),
                "strategic": bool(attrs.get("Strategic_Partners")),
                "url": (attrs.get("link_url") or "").strip(),
                "descriptionHtml": maybe_html(attrs.get("description", "")),
                "icon": img(attrs.get("icon")),
            }
        )
    return mapped


def map_individual(items):
    return [{"id": i.get("id"), "name": get(i, "attributes", "partner_name", default="")} for i in (items or [])]


def map_supporters(supporters_obj):
    icons = get(supporters_obj, "data", "attributes", "icons", "data", default=[]) or []
    return [cms_url(get(icon, "attributes", "url", default="")) for icon in icons]


def map_albums(items):
    mapped = []
    for item in items or []:
        attrs = item.get("attributes", {})
        photos = get(attrs, "album_photos", "data", default=None)
        if photos is None:
            photos = get(attrs, "photos", "data", default=[]) or []
        mapped.append(
            {
                "id": item.get("id"),
                "title": attrs.get("Title") or attrs.get("Album_title", ""),
                "slug": attrs.get("slug", ""),
                "coverImage": img(attrs.get("feature_image")) or img(attrs.get("Banner")),
                "images": [cms_url(get(photo, "attributes", "url", default="")) for photo in photos],
            }
        )
    return mapped


def map_videos(items):
    mapped = []
    for item in items or []:
        attrs = item.get("attributes", {})
        mapped.append(
            {
                "id": item.get("id"),
                "title": attrs.get("Title", ""),
                "source": attrs.get("Source", ""),
                "slug": attrs.get("slug", ""),
                "url": attrs.get("url", ""),
                "thumbnail": img(attrs.get("thumbnail")),
                "file": img(attrs.get("video")),
            }
        )
    return mapped


def map_publications(items):
    mapped = []
    for item in items or []:
        attrs = item.get("attributes", {})
        mapped.append(
            {
                "id": item.get("id"),
                "title": attrs.get("Title", ""),
                "subText": attrs.get("sub_text", ""),
                "slug": attrs.get("slug", ""),
                "image": img(attrs.get("feature_image")),
                "file": attrs.get("file", ""),
            }
        )
    return mapped


def main():
    result = {key: fetch_json(endpoint) for key, endpoint in ENDPOINTS.items()}

    locale = get(result, "localization", "data", "attributes", "locale_json", default={}) or {}
    banner = get(result, "banner", "data", "attributes", default={}) or {}

    content = {
        "meta": {
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "sourceSite": "https://enf.finehhstaging.com",
            "cmsOrigin": CMS_ORIGIN,
            "note": "Generated from public CMS/API endpoints referenced by the live website.",
        },
        "navigation": NAV,
        "branding": {
            "siteName": locale.get("headTitle", "Elia Nuqul Foundation"),
            "headerLogo": cms_url(get(locale, "header", "logo", default="")),
            "footerLogo": cms_url(get(locale, "footer", "logo", default="")),
        },
        "contact": {
            "address": get(locale, "footer", "menu", "address", default="154 Amman 11118 Jordan"),
            "phone1": get(locale, "footer", "contact-1", default="+962 6 4652688"),
            "phone2": get(locale, "footer", "contact-2", default="+962 6 4645669"),
            "email": (get(locale, "footer", "email", default="enf{'@'}nuqulgroup.com") or "").replace("{'@'}", "@"),
            "social": SOCIAL_LINKS,
        },
        "ctas": {
            "donateText": get(locale, "getInvolved", "donateText", default=None)
            or get(locale, "donateNowPage", "mainHeading", default=None)
            or "Your generous support will enable our scholars to continue their education.",
            "donateButton": locale.get("donateNow", "Donate Now"),
        },
        "banners": {
            "whoWeAre": img({"data": get(banner, "Who_We_Are_Banner", "data", default={})}),
            "ourStory": img({"data": get(banner, "Our_Story_Banner", "data", default={})}),
            "whatWeDo": img({"data": get(banner, "What_We_Do_Banner", "data", default={})}),
            "partners": img({"data": get(banner, "Our_Partners_Banner", "data", default={})}),
            "impact": img({"data": get(banner, "Our_Impact_Banner", "data", default={})}),
            "mediaCenter": img({"data": get(banner, "Media_Center_Banner", "data", default={})}),
            "donateNow": img({"data": get(banner, "Donate_Now_Banner", "data", default={})}),
        },
        "home": {
            "sliders": [
                {
                    "heading": get(item, "attributes", "Heading", default=""),
                    "headingPlain": plain_text(get(item, "attributes", "Heading", default="")),
                    "image": img(get(item, "attributes", "backgroundImage", default={})),
                }
                for item in get(result, "sliders", "data", default=[]) or []
            ],
            "whoWeAre": {
                "heading": get(result, "homeWhoWeAre", "data", "attributes", "Heading", default="Who We Are"),
                "subText": get(result, "homeWhoWeAre", "data", "attributes", "SubText", default=""),
                "buttonText": get(result, "homeWhoWeAre", "data", "attributes", "Button", default="Read More"),
                "buttonUrl": get(result, "homeWhoWeAre", "data", "attributes", "ButtonURL", default="/pages/who-we-are.html"),
                "images": [
                    img(get(result, "homeWhoWeAre", "data", "attributes", "image1", default={})),
                    img(get(result, "homeWhoWeAre", "data", "attributes", "image2", default={})),
                    img(get(result, "homeWhoWeAre", "data", "attributes", "image3", default={})),
                    img(get(result, "homeWhoWeAre", "data", "attributes", "image4", default={})),
                ],
                "watermark": img(get(result, "homeWhoWeAre", "data", "attributes", "watermarkImage", default={})),
            },
            "ourStory": {
                "heading": get(result, "homeOurStory", "data", "attributes", "Heading", default="Our Story"),
                "descriptionHtml": maybe_html(get(result, "homeOurStory", "data", "attributes", "Description", default="")),
                "videoUrl": get(result, "homeOurStory", "data", "attributes", "youtube_link", default=""),
                "thumbnail": img(get(result, "homeOurStory", "data", "attributes", "thumbnail_image", default={})),
            },
            "partners": {
                "heading": get(locale, "home", "section6", "heading", default="Together We Are"),
                "accent": get(locale, "home", "section6", "subHeading", default="Strengthening"),
                "tail": get(locale, "home", "section6", "subHeading2", default="Humanity"),
                "subTitle": get(locale, "home", "section6", "title", default="Lend A Hand To Bring A Smile"),
                "logos": [
                    cms_url(get(icon, "attributes", "url", default=""))
                    for icon in get(result, "partnerIcons", "data", "attributes", "icons", "data", default=[])
                    or []
                ],
            },
        },
        "whatWeDo": {
            "pageTitle": get(locale, "header", "menu", "interventions", default="What We Do"),
            "descriptionHtml": maybe_html(get(locale, "interventions", "description", default="")),
            "programs": map_programs(get(result, "interventions", "data", default=[])),
        },
        "whoWeAre": {
            "sections": map_who_we_are(get(result, "whoWeAre", "data", default=[])),
        },
        "ourStory": {
            "introTitle": get(result, "homeOurStory", "data", "attributes", "Heading", default="Our Story"),
            "introHtml": maybe_html(get(result, "homeOurStory", "data", "attributes", "Description", default="")),
            "videoUrl": get(result, "homeOurStory", "data", "attributes", "youtube_link", default=""),
            "thumbnail": img(get(result, "homeOurStory", "data", "attributes", "thumbnail_image", default={})),
            "timeline": map_timeline(get(result, "ourStoryTimeline", "data", default=[])),
        },
        "partners": {
            "sectionCards": [
                {
                    "title": get(result, "partnersPage", "data", "attributes", "section_1_title", default="")
                    or get(locale, "partners", "institutional-donors", default="Institutional Donors"),
                    "subtitle": get(result, "partnersPage", "data", "attributes", "section_1_subtitle", default=""),
                    "featureImage": img(get(result, "partnersPage", "data", "attributes", "section_1_feature_image", default={})),
                    "bannerImage": img(get(result, "partnersPage", "data", "attributes", "section_1_banner_image", default={})),
                },
                {
                    "title": get(result, "partnersPage", "data", "attributes", "section_2_title", default="")
                    or get(locale, "partners", "individual-donors", default="Individual Donors"),
                    "subtitle": get(result, "partnersPage", "data", "attributes", "section_2_subtitle", default=""),
                    "featureImage": img(get(result, "partnersPage", "data", "attributes", "section_2_feature_image", default={})),
                    "bannerImage": img(get(result, "partnersPage", "data", "attributes", "section_2_banner_image", default={})),
                },
                {
                    "title": get(result, "partnersPage", "data", "attributes", "section_3_title", default="")
                    or get(locale, "partners", "supporters", default="Supporters"),
                    "subtitle": get(result, "partnersPage", "data", "attributes", "section_3_subtitle", default=""),
                    "featureImage": img(get(result, "partnersPage", "data", "attributes", "section_3_feature_image", default={})),
                    "bannerImage": img(get(result, "partnersPage", "data", "attributes", "section_3_banner_image", default={})),
                },
            ],
            "institutional": map_institutional(get(result, "partnersInstitutional", "data", default=[])),
            "individual": map_individual(get(result, "partnersIndividual", "data", default=[])),
            "supporters": map_supporters(result.get("partnersSupporters", {})),
        },
        "impact": {
            "stories": map_stories(get(result, "successStories", "data", default=[])),
        },
        "mediaCenter": {
            "sections": [
                {
                    "title": get(result, "mediaCenterPage", "data", "attributes", f"section_{index}_title", default=""),
                    "subtitle": get(result, "mediaCenterPage", "data", "attributes", f"section_{index}_subtitle", default=""),
                    "featureImage": img(
                        get(result, "mediaCenterPage", "data", "attributes", f"section_{index}_feature_image", default={})
                    ),
                    "bannerImage": img(
                        get(result, "mediaCenterPage", "data", "attributes", f"section_{index}_banner_image", default={})
                    ),
                }
                for index in [1, 2, 3, 4]
            ],
            "news": map_news(get(result, "news", "data", default=[])),
            "photoAlbums": map_albums(get(result, "mediaPhotoAlbums", "data", default=[])),
            "archivedAlbums": map_albums(get(result, "photoAlbums", "data", default=[])),
            "videos": map_videos(get(result, "albumVideos", "data", default=[])),
            "publications": map_publications(get(result, "publications", "data", default=[])),
        },
        "donate": {
            "heading": get(result, "donateNow", "data", "attributes", "title", default="")
            or locale.get("donateNow", "Donate Now"),
            "subText": get(result, "donateNow", "data", "attributes", "sub_text", default="")
            or get(locale, "donateNowPage", "mainHeading", default="")
            or "Your generous support will enable our scholars to continue their education.",
            "expensesPerScholar": get(result, "donateNow", "data", "attributes", "expenses_per_scholar", default=""),
            "upperButtonText": get(result, "donateNow", "data", "attributes", "button_upper_text", default=""),
            "methods": [
                {
                    "text": get(item, "attributes", "text", default=""),
                    "desktopLink": get(item, "attributes", "desktop_link", default=""),
                    "mobileLink": get(item, "attributes", "mobile_link", default=""),
                }
                for item in get(result, "donationMethods", "data", default=[])
                or []
            ],
            "serviceCategories": [
                {
                    "amount": get(item, "attributes", "Amount", default=""),
                    "currency": get(item, "attributes", "currency", default="JOD"),
                    "code": get(item, "attributes", "code", default=""),
                }
                for item in get(result, "serviceCategories", "data", default=[])
                or []
            ],
            "donationServices": [
                {
                    "service": get(item, "attributes", "Service", default=""),
                    "code": get(item, "attributes", "code", default=""),
                }
                for item in get(result, "donationServices", "data", default=[])
                or []
            ],
            "contentTitle": get(result, "donateNowContent", "data", "attributes", "title", default="Donation"),
            "contentHtml": maybe_html(get(result, "donateNowContent", "data", "attributes", "Content", default="")),
            "contentButton": get(result, "donateNowContent", "data", "attributes", "button", default="Go Back"),
        },
        "donationEducationProgram": {
            "heading": get(result, "donationEducation", "data", "attributes", "heading", default="Donation for Education Program"),
            "descriptionHtml": maybe_html(get(result, "donationEducation", "data", "attributes", "description", default="")),
        },
        "policies": {
            "privacyHtml": maybe_html(get(result, "privacy", "data", "attributes", "policy", default="")),
            "termsHtml": maybe_html(get(result, "terms", "data", "attributes", "terms", default="")),
        },
    }

    content["home"]["whoWeAre"]["images"] = [u for u in content["home"]["whoWeAre"]["images"] if u]

    output_js = os.path.join(ROOT_DIR, "assets/js/enf-content.js")
    with open(output_js, "w", encoding="utf-8") as f:
        f.write("window.ENF_CONTENT = ")
        json.dump(content, f, ensure_ascii=False, indent=2)
        f.write(";\n")

    docs_path = os.path.join(ROOT_DIR, "docs/content-sources.md")
    with open(docs_path, "w", encoding="utf-8") as f:
        f.write("# Content Sources\n\n")
        f.write("This front-end rebuild uses public content from the live ENF CMS APIs.\n\n")
        f.write("## API Endpoints\n")
        for endpoint in ENDPOINTS.values():
            f.write(f"- {API_BASE}/{endpoint}\n")
        f.write("\n## Notes\n")
        f.write(f"- Generated date: {datetime.now(timezone.utc).isoformat()}\n")
        f.write("- Locale used for this rebuild: en\n")
        f.write("- This file was generated by scripts/fetch_enf_content.py\n")

    print(f"Wrote {output_js}")
    print(f"Wrote {docs_path}")


if __name__ == "__main__":
    main()
