var showdownConvertor;
var postYears = new Set();
var postInYear = new Map();

function useShowDown(conv) {
    showdownConvertor = conv;
}

function getMonthAsName(monthNumber) {
    var months = {
        '01': 'Jan',
        '02': 'Feb',
        '03': 'Mar',
        '04': 'Apr',
        '05': 'May',
        '06': 'Jun',
        '07': 'Jul',
        '08': 'Aug',
        '09': 'Sep',
        '10': 'Oct',
        '11': 'Nov',
        '12': 'Dec'
    }
    return months[monthNumber];

}

function readAndProcessTagList() {
    var tag = localStorage.getItem('showTagList');
    var postInYear = new Map(JSON.parse(localStorage.getItem("postInYear")));

    var year;
    var month;
    var title;
    var day;

    var htmlContent = "";

    postInYear.forEach((value, key, _) => {
        var keyAlreadyCovered = false;
        value.forEach((post) => {
            if (post.tags.includes(tag)) {
                title = post.title;
                year = key;
                month = post.month;
                day = post.day;

                if (!keyAlreadyCovered) {
                    htmlContent = htmlContent + `<div><div id="blog-list-year" class="blog-list-year">` + year + `</div><ul class="blog-list-sep-year">`
                    keyAlreadyCovered = true;
                }

                htmlContent = htmlContent + `<li class="blog-list-item">
                        <a href="../blog/blog-post.html" class="content-link" onclick="(function(){
                            localStorage['year'] = ` + `${year}` + `;
                            localStorage['month'] = ` + `${month}` + `;
                            localStorage['day'] = ` + `${day}` + `;
                        })();">
                            <span id="blog-list-title" class="blog-list-title">` + title + `</span>
                            <span class="blog-list-date">` + day + " " + getMonthAsName(month) + `</span>
                        </a>
                    </li>`

            }
        })
        if (keyAlreadyCovered) {
            htmlContent = htmlContent + "</ul></div>";
        }
    });

    window.addEventListener('load', function () {
        document.getElementById("blog-title").innerHTML = tag;
        document.getElementById("blog-content").innerHTML = htmlContent;
    });
}

function readAndProcessBlogListFile() {

    if (localStorage.getItem('showTagList')) {
        readAndProcessTagList();
        return;
    }

    var blogFile = new XMLHttpRequest();

    blogFile.onreadystatechange = function () {
        var allText = blogFile.responseText;
        if (blogFile.readyState === 4) {
            var allPostsData = allText.split("---\n");
            allPostsData.forEach((postData) => {
                if (postData !== "") {
                    var postAttributes = postData.split("; ");
                    var postTitle = postAttributes[0].split("title: ")[1];
                    var postDate = postAttributes[1].split("date: ")[1];
                    var [postYear, postMonth, postDay] = postDate.split("-");
                    var postTags = postAttributes[2].replace('\n', '').split("tags: ")[1].split(" "); // array of tags
                    var postShareLink = postAttributes[3]?.replace('\n', '').split("share: ")[1];
                    postYears.add(postYear);
                    if (postInYear.has(postYear)) {
                        let existingEntry = postInYear.get(postYear);
                        existingEntry.push({
                            title: postTitle,
                            month: postMonth,
                            day: postDay,
                            tags: postTags,
                            link: postShareLink
                        });
                        postInYear.set(postYear, existingEntry);
                    } else {
                        postInYear.set(postYear, [{
                            title: postTitle,
                            month: postMonth,
                            day: postDay,
                            tags: postTags,
                            link: postShareLink
                        }]);
                    }
                }
            });

            htmlContent = "";
            postYears = Array.from(postYears);

            // Reverse -> Latest year first
            postYears.sort().reverse();

            // Due to some bug, not able to store the ${post.title} inside local-storage (gives "Unexpected identifier error")
            // Hence storing the map in SessionStorage and doing a reverse lookup on blog-content load.
            localStorage.setItem("postInYear", JSON.stringify(Array.from(postInYear.entries())));

            for (var year of postYears) {
                htmlContent = htmlContent + `<div><div id="blog-list-year" class="blog-list-year">` + year + `</div><ul class="blog-list-sep-year">`

                var sortedPostsInYear = postInYear.get(year).sort((a, b) => {
                    var aDate = new Date();
                    var bDate = new Date();

                    aDate.setDate(a.day);
                    aDate.setMonth(a.month);
                    bDate.setDate(b.day);
                    bDate.setMonth(b.month);

                    // Reverse sorting order - Latest Post of year first
                    return bDate - aDate;
                });

                for (var post of sortedPostsInYear) {
                    htmlContent = htmlContent + `<li class="blog-list-item">
                        <a href="../blog/blog-post.html" class="content-link" onclick="(function(){
                            localStorage['year'] = ` + `${year}` + `;
                            localStorage['month'] = ` + `${post.month}` + `;
                            localStorage['day'] = ` + `${post.day}` + `;
                        })();">
                             <span id="blog-list-title" class="blog-list-title">` + post.title + `</span>
                             <span class="blog-list-date">` + post.day + " " + getMonthAsName(post.month) + `</span>
                         </a>
                     </li>`
                }
                htmlContent = htmlContent + "</ul></div>";
            }
            document.getElementById("blog-content").innerHTML = htmlContent;
        }
    }

    var blogFileName = "/layout/blog-list.md";
    blogFile.open("GET", blogFileName, true);
    blogFile.send(null);
}