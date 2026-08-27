(function () {
  "use strict";

  var hero = document.getElementById("campaign-hero");
  var heroContent = document.getElementById("hero-content");
  var video = document.getElementById("campaign-video");
  var soundToggle = document.getElementById("sound-toggle");
  var nav = document.querySelector(".campaign-nav");
  var form = document.getElementById("campaign-lead-form");
  var statusBox = document.getElementById("form-status");
  var submitButton = form ? form.querySelector(".submit-button") : null;
  var namePattern = /^[\u0600-\u06FFa-zA-Z][\u0600-\u06FFa-zA-Z\s'’-]{1,79}$/;
  var emailPattern = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function updateHero() {
    if (!hero || !heroContent) return;
    var rect = hero.getBoundingClientRect();
    var scrollable = Math.max(hero.offsetHeight - window.innerHeight, 1);
    var progress = clamp(-rect.top / scrollable, 0, 1);
    var reveal = clamp((progress - 0.08) / 0.34, 0, 1);
    hero.style.setProperty("--hero-progress", progress.toFixed(3));
    heroContent.style.setProperty("--hero-reveal", reveal.toFixed(3));
    if (nav) nav.classList.toggle("is-scrolled", window.scrollY > 36);
  }

  function setSoundState(isOn) {
    if (!video || !soundToggle) return;
    video.muted = !isOn;
    soundToggle.setAttribute("aria-pressed", isOn ? "true" : "false");
    var label = isOn ? "إيقاف الصوت" : "تشغيل الصوت";
    soundToggle.setAttribute("aria-label", label);
    soundToggle.setAttribute("title", label);
  }

  if (soundToggle && video) {
    soundToggle.addEventListener("click", function () {
      var turnOn = video.muted;
      setSoundState(turnOn);
      if (video.paused) {
        video.play().catch(function () {
          setSoundState(false);
        });
      }
    });
    video.play().catch(function () {
      setSoundState(false);
    });
  }

  var revealObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.16 });

  document.querySelectorAll(".reveal-on-scroll").forEach(function (element) {
    revealObserver.observe(element);
  });

  function apiBase() {
    var configured = document.querySelector('meta[name="campaign-api-base"]');
    var value = configured ? configured.getAttribute("content").trim() : "";
    if (value) return value.replace(/\/$/, "");
    if (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost") {
      return "http://127.0.0.1:8000/api/v1";
    }
    return "";
  }

  function donationUrl() {
    var meta = document.querySelector('meta[name="efawateercom-donation-url"]');
    return meta ? meta.getAttribute("content").trim() : "";
  }

  function normalizedJordanPhone(value) {
    var digits = String(value || "").replace(/\D/g, "");
    if (digits.indexOf("00962") === 0) digits = digits.slice(5);
    if (digits.indexOf("962") === 0) digits = digits.slice(3);
    if (digits.indexOf("0") === 0) digits = digits.slice(1);
    return /^7[789]\d{7}$/.test(digits) ? "+962" + digits : "";
  }

  function setError(id, message) {
    var input = document.getElementById(id);
    var error = document.querySelector('[data-error-for="' + id + '"]');
    if (error) error.textContent = message || "";
    if (!input) return;
    input.classList.toggle("is-invalid", Boolean(message));
    input.setAttribute("aria-invalid", message ? "true" : "false");
    if (id === "phone") {
      var control = input.closest(".phone-control");
      if (control) control.classList.toggle("is-invalid", Boolean(message));
    }
  }

  function validateForm() {
    var values = Object.fromEntries(new FormData(form).entries());
    var valid = true;
    ["first-name", "last-name", "email", "phone", "consent"].forEach(function (id) {
      setError(id, "");
    });

    [
      ["first-name", values.first_name, "يرجى إدخال الاسم الأول بشكل صحيح."],
      ["last-name", values.last_name, "يرجى إدخال اسم العائلة بشكل صحيح."]
    ].forEach(function (entry) {
      if (!namePattern.test(String(entry[1] || "").trim())) {
        setError(entry[0], entry[2]);
        valid = false;
      }
    });

    if (!emailPattern.test(String(values.email || "").trim())) {
      setError("email", "أدخل بريدًا إلكترونيًا صحيحًا، مثل name@example.com.");
      valid = false;
    }

    var phone = normalizedJordanPhone(values.phone);
    if (!phone) {
      setError("phone", "أدخل رقم هاتف خلوي أردني صحيحًا.");
      valid = false;
    }

    if (!document.getElementById("consent").checked) {
      setError("consent", "الموافقة مطلوبة للمتابعة.");
      valid = false;
    }

    return {
      valid: valid,
      payload: {
        first_name: String(values.first_name || "").trim(),
        last_name: String(values.last_name || "").trim(),
        email: String(values.email || "").trim().toLowerCase(),
        phone: phone,
        consent: document.getElementById("consent").checked,
        website: String(values.website || ""),
        source: window.location.href,
        utm_source: new URLSearchParams(window.location.search).get("utm_source") || null,
        utm_medium: new URLSearchParams(window.location.search).get("utm_medium") || null,
        utm_campaign: new URLSearchParams(window.location.search).get("utm_campaign") || null
      }
    };
  }

  function showStatus(message, isError) {
    statusBox.textContent = message;
    statusBox.classList.add("is-visible");
    statusBox.classList.toggle("is-error", Boolean(isError));
  }

  if (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var result = validateForm();
      if (!result.valid) {
        showStatus("يرجى مراجعة الحقول الموضّحة قبل المتابعة.", true);
        var invalid = form.querySelector('[aria-invalid="true"]');
        if (invalid) invalid.focus();
        return;
      }

      var base = apiBase();
      if (!base) {
        showStatus("خدمة تسجيل البيانات غير مرتبطة بالخادم بعد. يرجى المحاولة عند إطلاق الحملة.", true);
        return;
      }

      submitButton.disabled = true;
      submitButton.querySelector(".button-label").textContent = "جارٍ حفظ البيانات...";
      showStatus("جارٍ تسجيل بياناتك بأمان...", false);

      fetch(base + "/campaigns/back-to-university/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.payload)
      })
        .then(function (response) {
          return response.json().catch(function () { return {}; }).then(function (data) {
            if (!response.ok) throw new Error(data.detail || "تعذّر تسجيل البيانات.");
            return data;
          });
        })
        .then(function (data) {
          showStatus("تم تسجيل بياناتك بنجاح. جارٍ تحويلك إلى إي فواتيركم...", false);
          var target = data.redirect_url || donationUrl();
          if (target) {
            window.setTimeout(function () { window.location.assign(target); }, 700);
          } else {
            showStatus("تم تسجيل بياناتك بنجاح. سيتم تفعيل رابط التبرّع عبر إي فواتيركم فور استلامه.", false);
            form.reset();
          }
        })
        .catch(function (error) {
          showStatus(error.message || "تعذّر تسجيل البيانات. يرجى المحاولة مرة أخرى.", true);
        })
        .finally(function () {
          submitButton.disabled = false;
          submitButton.querySelector(".button-label").textContent = "تبرع الآن";
        });
    });

    form.querySelectorAll("input").forEach(function (input) {
      input.addEventListener("input", function () {
        setError(input.id, "");
      });
    });
  }

  document.getElementById("campaign-year").textContent = new Date().getFullYear();
  window.addEventListener("scroll", updateHero, { passive: true });
  window.addEventListener("resize", updateHero);
  updateHero();
})();
