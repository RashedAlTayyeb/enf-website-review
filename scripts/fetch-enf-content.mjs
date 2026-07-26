import fs from "node:fs/promises";
import path from "node:path";

const CMS_ORIGIN = "https://enf-cms.finehhstaging.com";
const API_BASE = `${CMS_ORIGIN}/api`;

const endpoints = {
  sliders: "sliders?populate=*&locale=en",
  homeWhoWeAre: "home-who-we-are?populate=*&locale=en",
  homeOurStory: "home-our-story?populate=*&locale=en",
  interventions: "interventions?populate=*&locale=en",
  news: "newses?populate=*&sort[0]=slug:desc&locale=en",
  successStories: "success-stories?populate=*&locale=en",
  partnerIcons: "home-our-partner-icon?populate=*",
  whoWeAre: "who-we-ares?populate=*&locale=en",
  ourStoryTimeline: "our-story-pages?locale=en",
  banner: "banner?populate=*&locale=en",
  partnersPage: "our-partners-page?populate=*&locale=en",
  partnersInstitutional: "partners-institutional-donors?populate=*&locale=en",
  partnersIndividual: "partners-individual-donors?populate=*&locale=en",
  partnersSupporters: "partners-supporter?populate=*&locale=en",
  mediaCenterPage: "media-center-page?populate=*&locale=en",
  mediaPhotoAlbums: "media-center-photo-albums?populate=*&locale=en",
  photoAlbums: "photo-albums?populate=*&locale=en",
  albumVideos: "album-videos?populate=*&locale=en",
  publications: "publications?populate=*&locale=en",
  donateNow: "donate-now?locale=en",
  donateNowContent: "donate-now-content?populate=*&locale=en",
  donationMethods: "donation-methods?locale=en",
  donationServices: "donation-services-plu?locale=en",
  serviceCategories: "service-categories?locale=en",
  donationEducation: "donation-for-education-program?locale=en",
  privacy: "privacy-policy?locale=en",
  terms: "terms-and-condition?locale=en",
  localization: "english-localization?locale=en&populate=*"
};

const socialLinks = [
  {
    label: "Facebook",
    url: "http://wwww.facebook.com/EliaNuqulFoundation",
    icon: "facebook"
  },
  {
    label: "Twitter",
    url: "http://www.Twitter.com/Elianuqulfdn",
    icon: "twitter"
  },
  {
    label: "YouTube",
    url: "https://www.youtube.com/user/EliaNuqulFoundation",
    icon: "youtube"
  },
  {
    label: "Instagram",
    url: "https://www.instagram.com/EliaNuqulFoundation/",
    icon: "instagram"
  },
  {
    label: "LinkedIn",
    url: "https://jo.linkedin.com/company/elia-nuqul-foundation",
    icon: "linkedin"
  }
];

const nav = [
  { id: "home", label: "Home", href: "/index.html" },
  { id: "who-we-are", label: "Who We Are", href: "/pages/who-we-are.html" },
  { id: "our-story", label: "Our Story", href: "/pages/our-story.html" },
  { id: "what-we-do", label: "What We Do", href: "/pages/what-we-do.html" },
  { id: "partners", label: "Our Partners", href: "/pages/partners.html" },
  { id: "our-impact", label: "Our Impact", href: "/pages/our-impact.html" },
  { id: "media-center", label: "Media Center", href: "/pages/media-center.html" }
];

function cmsUrl(url = "") {
  if (!url) return "";
  return url.startsWith("http") ? url : `${CMS_ORIGIN}${url}`;
}

function img(field) {
  return cmsUrl(field?.data?.attributes?.url || "");
}

function maybeHtml(value = "") {
  return value || "";
}

function plainText(html = "") {
  return String(html)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchJson(endpoint) {
  const response = await fetch(`${API_BASE}/${endpoint}`, {
    headers: { Accept: "application/json" }
  });
  if (!response.ok) {
    throw new Error(`Failed ${endpoint}: ${response.status}`);
  }
  return response.json();
}

function mapNews(items = []) {
  return items
    .filter((item) => item?.attributes?.Is_visible !== false)
    .map((item) => ({
      id: item.id,
      title: item.attributes?.Title || "",
      slug: item.attributes?.slug || "",
      articleHtml: maybeHtml(item.attributes?.Article),
      excerpt: plainText(item.attributes?.Article).slice(0, 220),
      featured: Boolean(item.attributes?.Featured),
      showOnHome: Boolean(item.attributes?.visible_homePage),
      image: img(item.attributes?.featured_image)
    }));
}

function mapPrograms(items = []) {
  return items
    .sort((a, b) => (a.attributes?.sequence || 0) - (b.attributes?.sequence || 0))
    .map((item) => ({
      id: item.id,
      title: item.attributes?.Title || "",
      slug: item.attributes?.slug || "",
      articleHtml: maybeHtml(item.attributes?.Article),
      excerpt: plainText(item.attributes?.Article).slice(0, 240),
      buttonText: item.attributes?.Button || "Read more",
      image: img(item.attributes?.feature_image),
      featured: Boolean(item.attributes?.Featured)
    }));
}

function mapWhoWeAre(items = []) {
  return items
    .sort((a, b) => (a.attributes?.sequence_no || 0) - (b.attributes?.sequence_no || 0))
    .filter((item) => item?.attributes?.is_visible !== false)
    .map((item) => ({
      id: item.id,
      sequence: item.attributes?.sequence_no || 0,
      title: item.attributes?.Title || "",
      slug: item.attributes?.slug || "",
      descriptionHtml: maybeHtml(item.attributes?.Description),
      summary: plainText(item.attributes?.Description).slice(0, 260),
      frontImage: img(item.attributes?.Front_image),
      backImage: img(item.attributes?.Back_image)
    }));
}

function mapTimeline(items = []) {
  return items
    .map((item) => ({
      year: item.attributes?.Year || "",
      descriptionHtml: maybeHtml(item.attributes?.short_decription),
      summary: plainText(item.attributes?.short_decription)
    }))
    .sort((a, b) => Number(a.year) - Number(b.year));
}

function mapStories(items = []) {
  return items
    .filter((item) => item?.attributes?.is_visible !== false)
    .map((item) => ({
      id: item.id,
      title: item.attributes?.Title || "",
      slug: item.attributes?.slug || "",
      designation: item.attributes?.Designation || "",
      articleHtml: maybeHtml(item.attributes?.Article),
      excerpt: plainText(item.attributes?.Article).slice(0, 220),
      featured: Boolean(item.attributes?.featured),
      image: img(item.attributes?.feature_image),
      bannerImage: img(item.attributes?.Banner_image)
    }));
}

function mapInstitutional(items = []) {
  return items
    .filter((item) => item?.attributes?.is_visible !== false)
    .map((item) => ({
      id: item.id,
      name: item.attributes?.title || "",
      core: Boolean(item.attributes?.Our_Core),
      strategic: Boolean(item.attributes?.Strategic_Partners),
      url: (item.attributes?.link_url || "").trim(),
      descriptionHtml: maybeHtml(item.attributes?.description),
      icon: img(item.attributes?.icon)
    }));
}

function mapIndividual(items = []) {
  return items.map((item) => ({
    id: item.id,
    name: item.attributes?.partner_name || ""
  }));
}

function mapSupporterIcons(supporters) {
  return (supporters?.data?.attributes?.icons?.data || []).map((entry) =>
    cmsUrl(entry?.attributes?.url || "")
  );
}

function mapAlbums(items = []) {
  return items.map((item) => ({
    id: item.id,
    title: item.attributes?.Title || item.attributes?.Album_title || "",
    slug: item.attributes?.slug || "",
    coverImage:
      img(item.attributes?.feature_image) ||
      img(item.attributes?.Banner) ||
      "",
    images: (item.attributes?.album_photos?.data || item.attributes?.photos?.data || []).map((p) =>
      cmsUrl(p?.attributes?.url || "")
    )
  }));
}

function mapVideos(items = []) {
  return items.map((item) => ({
    id: item.id,
    title: item.attributes?.Title || "",
    source: item.attributes?.Source || "",
    slug: item.attributes?.slug || "",
    url: item.attributes?.url || "",
    thumbnail: img(item.attributes?.thumbnail),
    file: img(item.attributes?.video)
  }));
}

function mapPublications(items = []) {
  return items.map((item) => ({
    id: item.id,
    title: item.attributes?.Title || "",
    subText: item.attributes?.sub_text || "",
    slug: item.attributes?.slug || "",
    image: img(item.attributes?.feature_image),
    file: item.attributes?.file || ""
  }));
}

async function build() {
  const result = {};

  for (const [key, endpoint] of Object.entries(endpoints)) {
    result[key] = await fetchJson(endpoint);
  }

  const locale = result.localization?.data?.attributes?.locale_json || {};
  const banner = result.banner?.data?.attributes || {};

  const content = {
    meta: {
      generatedAt: new Date().toISOString(),
      sourceSite: "https://enf.finehhstaging.com",
      cmsOrigin: CMS_ORIGIN,
      note:
        "Generated from public CMS/API endpoints referenced by the live website."
    },
    navigation: nav,
    branding: {
      siteName: locale.headTitle || "Elia Nuqul Foundation",
      headerLogo: cmsUrl(locale?.header?.logo || ""),
      footerLogo: cmsUrl(locale?.footer?.logo || "")
    },
    contact: {
      address: locale?.footer?.menu?.address || "154 Amman 11118 Jordan",
      phone1: locale?.footer?.["contact-1"] || "+962 6 4652688",
      phone2: locale?.footer?.["contact-2"] || "+962 6 4645669",
      email: (locale?.footer?.email || "enf{'@'}nuqulgroup.com").replace("{'@'}", "@"),
      social: socialLinks
    },
    ctas: {
      donateText:
        locale?.getInvolved?.donateText ||
        locale?.donateNowPage?.mainHeading ||
        "Your generous support will enable our scholars to continue their education.",
      donateButton: locale?.donateNow || "Donate Now"
    },
    banners: {
      whoWeAre: img({ data: banner?.Who_We_Are_Banner?.data }),
      ourStory: img({ data: banner?.Our_Story_Banner?.data }),
      whatWeDo: img({ data: banner?.What_We_Do_Banner?.data }),
      partners: img({ data: banner?.Our_Partners_Banner?.data }),
      impact: img({ data: banner?.Our_Impact_Banner?.data }),
      mediaCenter: img({ data: banner?.Media_Center_Banner?.data }),
      donateNow: img({ data: banner?.Donate_Now_Banner?.data })
    },
    home: {
      sliders: (result.sliders?.data || []).map((item) => ({
        heading: item.attributes?.Heading || "",
        headingPlain: plainText(item.attributes?.Heading),
        image: img(item.attributes?.backgroundImage)
      })),
      whoWeAre: {
        heading: result.homeWhoWeAre?.data?.attributes?.Heading || "Who We Are",
        subText: result.homeWhoWeAre?.data?.attributes?.SubText || "",
        buttonText: result.homeWhoWeAre?.data?.attributes?.Button || "Read More",
        buttonUrl: result.homeWhoWeAre?.data?.attributes?.ButtonURL || "/pages/who-we-are.html",
        images: [
          img(result.homeWhoWeAre?.data?.attributes?.image1),
          img(result.homeWhoWeAre?.data?.attributes?.image2),
          img(result.homeWhoWeAre?.data?.attributes?.image3),
          img(result.homeWhoWeAre?.data?.attributes?.image4)
        ].filter(Boolean),
        watermark: img(result.homeWhoWeAre?.data?.attributes?.watermarkImage)
      },
      ourStory: {
        heading: result.homeOurStory?.data?.attributes?.Heading || "Our Story",
        descriptionHtml: maybeHtml(result.homeOurStory?.data?.attributes?.Description),
        videoUrl: result.homeOurStory?.data?.attributes?.youtube_link || "",
        thumbnail: img(result.homeOurStory?.data?.attributes?.thumbnail_image)
      },
      partners: {
        heading: locale?.home?.section6?.heading || "Together We Are",
        accent: locale?.home?.section6?.subHeading || "Strengthening",
        tail: locale?.home?.section6?.subHeading2 || "Humanity",
        subTitle: locale?.home?.section6?.title || "Lend A Hand To Bring A Smile",
        logos: (result.partnerIcons?.data?.attributes?.icons?.data || []).map((item) =>
          cmsUrl(item?.attributes?.url || "")
        )
      }
    },
    whatWeDo: {
      pageTitle: locale?.header?.menu?.interventions || "What We Do",
      descriptionHtml: maybeHtml(locale?.interventions?.description || ""),
      programs: mapPrograms(result.interventions?.data)
    },
    whoWeAre: {
      sections: mapWhoWeAre(result.whoWeAre?.data)
    },
    ourStory: {
      introTitle: result.homeOurStory?.data?.attributes?.Heading || "Our Story",
      introHtml: maybeHtml(result.homeOurStory?.data?.attributes?.Description),
      videoUrl: result.homeOurStory?.data?.attributes?.youtube_link || "",
      thumbnail: img(result.homeOurStory?.data?.attributes?.thumbnail_image),
      timeline: mapTimeline(result.ourStoryTimeline?.data)
    },
    partners: {
      sectionCards: [
        {
          title:
            result.partnersPage?.data?.attributes?.section_1_title ||
            locale?.partners?.["institutional-donors"] ||
            "Institutional Donors",
          subtitle: result.partnersPage?.data?.attributes?.section_1_subtitle || "",
          featureImage: img(result.partnersPage?.data?.attributes?.section_1_feature_image),
          bannerImage: img(result.partnersPage?.data?.attributes?.section_1_banner_image)
        },
        {
          title:
            result.partnersPage?.data?.attributes?.section_2_title ||
            locale?.partners?.["individual-donors"] ||
            "Individual Donors",
          subtitle: result.partnersPage?.data?.attributes?.section_2_subtitle || "",
          featureImage: img(result.partnersPage?.data?.attributes?.section_2_feature_image),
          bannerImage: img(result.partnersPage?.data?.attributes?.section_2_banner_image)
        },
        {
          title:
            result.partnersPage?.data?.attributes?.section_3_title ||
            locale?.partners?.supporters ||
            "Supporters",
          subtitle: result.partnersPage?.data?.attributes?.section_3_subtitle || "",
          featureImage: img(result.partnersPage?.data?.attributes?.section_3_feature_image),
          bannerImage: img(result.partnersPage?.data?.attributes?.section_3_banner_image)
        }
      ],
      institutional: mapInstitutional(result.partnersInstitutional?.data),
      individual: mapIndividual(result.partnersIndividual?.data),
      supporters: mapSupporterIcons(result.partnersSupporters)
    },
    impact: {
      stories: mapStories(result.successStories?.data)
    },
    mediaCenter: {
      sections: [1, 2, 3, 4].map((index) => ({
        title: result.mediaCenterPage?.data?.attributes?.[`section_${index}_title`] || "",
        subtitle: result.mediaCenterPage?.data?.attributes?.[`section_${index}_subtitle`] || "",
        featureImage: img(result.mediaCenterPage?.data?.attributes?.[`section_${index}_feature_image`]),
        bannerImage: img(result.mediaCenterPage?.data?.attributes?.[`section_${index}_banner_image`])
      })),
      news: mapNews(result.news?.data),
      photoAlbums: mapAlbums(result.mediaPhotoAlbums?.data),
      archivedAlbums: mapAlbums(result.photoAlbums?.data),
      videos: mapVideos(result.albumVideos?.data),
      publications: mapPublications(result.publications?.data)
    },
    donate: {
      heading: result.donateNow?.data?.attributes?.title || locale?.donateNow || "Donate Now",
      subText:
        result.donateNow?.data?.attributes?.sub_text ||
        locale?.donateNowPage?.mainHeading ||
        "Your generous support will enable our scholars to continue their education.",
      expensesPerScholar: result.donateNow?.data?.attributes?.expenses_per_scholar || "",
      upperButtonText: result.donateNow?.data?.attributes?.button_upper_text || "",
      methods: (result.donationMethods?.data || []).map((item) => ({
        text: item.attributes?.text || "",
        desktopLink: item.attributes?.desktop_link || "",
        mobileLink: item.attributes?.mobile_link || ""
      })),
      serviceCategories: (result.serviceCategories?.data || []).map((item) => ({
        amount: item.attributes?.Amount || "",
        currency: item.attributes?.currency || "JOD",
        code: item.attributes?.code || ""
      })),
      donationServices: (result.donationServices?.data || []).map((item) => ({
        service: item.attributes?.Service || "",
        code: item.attributes?.code || ""
      })),
      contentTitle: result.donateNowContent?.data?.attributes?.title || "Donation",
      contentHtml: maybeHtml(result.donateNowContent?.data?.attributes?.Content),
      contentButton: result.donateNowContent?.data?.attributes?.button || "Go Back"
    },
    donationEducationProgram: {
      heading: result.donationEducation?.data?.attributes?.heading || "Donation for Education Program",
      descriptionHtml: maybeHtml(result.donationEducation?.data?.attributes?.description)
    },
    policies: {
      privacyHtml: maybeHtml(result.privacy?.data?.attributes?.policy),
      termsHtml: maybeHtml(result.terms?.data?.attributes?.terms)
    }
  };

  const outputPath = path.resolve("/Users/rashedal-tayyeb/Desktop/ENF/assets/js/enf-content.js");
  await fs.writeFile(
    outputPath,
    `window.ENF_CONTENT = ${JSON.stringify(content, null, 2)};\n`,
    "utf8"
  );

  const docsPath = path.resolve("/Users/rashedal-tayyeb/Desktop/ENF/docs/content-sources.md");
  const endpointList = Object.values(endpoints)
    .map((e) => `- ${API_BASE}/${e}`)
    .join("\n");
  const docs = `# Content Sources\n\nThis front-end rebuild uses public content from the live ENF CMS APIs.\n\n## API Endpoints\n${endpointList}\n\n## Notes\n- Generated date: ${new Date().toISOString()}\n- Locale used for this rebuild: en\n- This file was generated by scripts/fetch-enf-content.mjs\n`;
  await fs.writeFile(docsPath, docs, "utf8");

  console.log(`Wrote ${outputPath}`);
  console.log(`Wrote ${docsPath}`);
}

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
