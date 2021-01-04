var showdownConvertor;
var postInYear = new Map();
var postShareableLink;

function openImageInEnlargedScreen(image) {
    setTimeout(() => {
        image.style.transform = "scale(2.2)";
        image.style.transition = "transform 0.25s ease";
    }, 50);

    document.body.addEventListener("click", function () {
        closeAllImagesInEnlargedScreen(image);
    });
}

function closeAllImagesInEnlargedScreen(imageEntry) {
    imageEntry.style.transform = "scale(1)";
    imageEntry.style.transition = "transform 0.25s ease";
}

function addCustomClassNames(text) {
    text = text.replaceAll("<a href", '<a class="content-link" target="_blank" href').replaceAll(/<img src=(.*) alt=(.*)\/>/g, '<img class="blog-image" onClick=openImageInEnlargedScreen(this) src=$1 alt=$2/>');
    return text;
}

function showTagList() {
    localStorage.setItem("showTagList", "true");
}

function readAndProcessBlogFile() {
    var year = localStorage["year"];
    var month = localStorage["month"];
    var day = localStorage["day"];
    var title;
    var tags;
    var link;

    var postInYear = new Map(JSON.parse(localStorage.getItem("postInYear")));
    postInYear.forEach((value, key, _) => {
        if (parseInt(key) === parseInt(year)) {
            value.forEach((post) => {
                if ((parseInt(post.month) === parseInt(month)) && (parseInt(post.day) === parseInt(day))) {
                    title = post.title;
                    tags = post.tags;
                    // Re-init since 2 & 02 are different as string
                    year = key;
                    month = post.month;
                    day = post.day;
                    link = post.link;
                }
            })
        }
    });

    var blogFile = new XMLHttpRequest();

    blogFile.onreadystatechange = function () {
        var allText = blogFile.responseText;
        if ((blogFile.readyState === 4) && (blogFile.status === 200)) {
            var blogContent = showdownConvertor.makeHtml(allText);
            blogContent = addCustomClassNames(blogContent);
            document.getElementById("blog-content").innerHTML = blogContent;

            var blogDate = "📅 {day}.{month}.{year}";
            blogDate = blogDate.replace("{day}", day).replace("{month}", getMonthAsName(month)).replace("{year}", year);
            document.getElementById("blog-date").innerHTML = showdownConvertor.makeHtml(blogDate);

            var numWords = allText.split(' ').length;

            var blogLength = "📚 {words} words";
            blogLength = blogLength.replace("{words}", numWords);
            document.getElementById("blog-length").innerHTML = showdownConvertor.makeHtml(blogLength);

            var readingTime = Math.ceil(numWords / 275.0 + (document.getElementsByClassName("blog-image").length * 12) / 60.0);
            var blogReadTime = (readingTime > 1) ? "🕔 {minutes} minutes" : "🕔 {minutes} minute";
            blogReadTime = blogReadTime.replace("{minutes}", readingTime);
            document.getElementById("blog-read-time").innerHTML = showdownConvertor.makeHtml(blogReadTime);

            var blogTags = "📌 {tagList}";
            var tagList = [];
            tags = tags.forEach((tag) => {
                tagList.push(tag.replaceAll(/#(.*)/g, "[#$1](../blog/blog-list.html){:onclick='localStorage.setItem('showTagList', '#$1')'}"));
            });
            var tagListString = tagList.join(" ");
            blogTags = blogTags.replace("{tagList}", tagListString);
            var blogTagContent = showdownConvertor.makeHtml(blogTags);
            blogTagContent = blogTagContent.replaceAll("<a href", '<a class="blog-tag-button" href');
            document.getElementById("blog-tags").innerHTML = blogTagContent;

            document.getElementById("blog-title").innerHTML = showdownConvertor.makeHtml(title);
            /* 30K line blog with around 3L words takes 480ms for total processing, 680ms
            if we also consider the time to print all the text inside HTML */
        } else if (blogFile.readyState === 4) {
            setLink(null);
        }
    }

    var blogFileName = "/posts/{year}-{month}-{day}-{title}.md";
    var smallCasedSeparatedTitle = title.toLowerCase().split(' ').join("-");
    blogFileName = blogFileName.replace("{year}", year).replace("{month}", month).replace("{day}", day).replace("{title}", smallCasedSeparatedTitle);
    blogFile.open("GET", blogFileName, true);
    blogFile.send(null);

    window.addEventListener('load', function () {
        setLink(link);
    });
}

function copyLink() {
    let link = postShareableLink;
    if (link === null) {
        link = "https://twitter.com/@prnvdixit";
    }
    navigator.clipboard.writeText(link);
}

function setLink(link) {
    postShareableLink = link;
}

class Popover {
    constructor(element, trigger) {
        this.element = element;
        this.trigger = trigger;
        this._isOpen = false;
        this.trigger.addEventListener('click', this.toggle.bind(this));
        this.element.style.display = 'none';
    }

    toggle(e) {
        e.stopPropagation();
        if (this._isOpen) {
            this.close(e);
        } else {
            this.element.style.display = 'block';
            this._isOpen = true;
            setTimeout(() => {
                this.close(e);
            }, 1000);
        }
    }

    close(e) {
        this.element.style.display = 'none';
        this._isOpen = false;
    }
}

document.addEventListener('DOMContentLoaded', function () {
    let template = document.getElementById("popover");
    let btn = document.querySelector('#popoverOpener a');
    new Popover(template, btn);
});