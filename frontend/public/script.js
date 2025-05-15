const API_URL = 'https://web-blog-afow.vercel.app';

document.addEventListener('DOMContentLoaded', () => {
    // Toggle profile menu visibility
    window.toggleProfileMenu = function () {
        const profileMenu = document.getElementById('profileMenu');
        if (profileMenu) {
            profileMenu.style.display = profileMenu.style.display === 'block' ? 'none' : 'block';
        }
    };

    // Toggle categories menu visibility
    window.toggleCategoriesMenu = function () {
        const categoriesMenu = document.getElementById('categoriesMenu');
        if (categoriesMenu) {
            categoriesMenu.style.display = categoriesMenu.style.display === 'block' ? 'none' : 'block';
        }
    };

    // Toggle nav menu visibility (hamburger menu)
    window.toggleMenu = function () {
        const navMenu = document.getElementById('navMenu');
        if (navMenu) {
            navMenu.style.display = navMenu.style.display === 'block' ? 'none' : 'block';
        }
    };

    // Logout function
    window.logout = function () {
        localStorage.removeItem('token');
        window.location.href = 'index.html';
    };

    // Show/hide profile or auth buttons based on token presence
    const token = localStorage.getItem('token');
    const profileElement = document.querySelector('.profile');
    const authButtons = document.getElementById('authButtons');
    if (token) {
        if (profileElement) profileElement.style.display = 'block';
        if (authButtons) authButtons.style.display = 'none';
        const commentForm = document.getElementById('commentForm');
        if (commentForm) commentForm.style.display = 'block';
    } else {
        if (profileElement) profileElement.style.display = 'none';
        if (authButtons) authButtons.style.display = 'block';
    }

    // Login button event
    document.getElementById('loginBtn')?.addEventListener('click', () => {
        window.location.href = 'login.html';
    });

    // Signup button event
    document.getElementById('signupBtn')?.addEventListener('click', () => {
        window.location.href = 'signup.html';
    });

    // Initialize Quill editor on create page
    if (window.location.pathname.endsWith('create.html') && typeof Quill !== 'undefined') {
        new Quill('#editor', {
            theme: 'snow',
            modules: {
                toolbar: [
                    [{ header: [1, 2, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    ['link', 'image', 'video'],
                    [{ list: 'ordered' }, { list: 'bullet' }],
                    ['clean']
                ]
            }
        });
    }

    // Signup form submission
    if (window.location.pathname.endsWith('signup.html')) {
        const signupForm = document.getElementById('signupForm');
        if (signupForm) {
            signupForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const username = document.getElementById('username').value;
                const password = document.getElementById('password').value;
                try {
                    const response = await fetch(`${API_URL}/api/signup`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username, password })
                    });
                    const data = await response.json();
                    alert(data.message);
                    if (response.status === 201) window.location.href = 'login.html';
                } catch {
                    alert('Signup failed.');
                }
            });
        }
    }

    // Login form submission
    if (window.location.pathname.endsWith('login.html')) {
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const username = document.getElementById('username').value;
                const password = document.getElementById('password').value;
                try {
                    const response = await fetch(`${API_URL}/api/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username, password })
                    });
                    const data = await response.json();
                    if (response.ok) {
                        localStorage.setItem('token', data.token);
                        window.location.href = 'index.html';
                    } else {
                        alert(data.message);
                    }
                } catch {
                    alert('Login failed.');
                }
            });
        }
    }

    // Create blog form submission
    if (window.location.pathname.endsWith('create.html')) {
        const createBlogForm = document.getElementById('createBlogForm');
        if (createBlogForm) {
            createBlogForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const title = document.getElementById('title').value;
                const category = document.getElementById('category').value;
                const content = document.querySelector('.ql-editor')?.innerHTML || '';
                const token = localStorage.getItem('token');
                if (!token) {
                    alert('Please log in.');
                    window.location.href = 'login.html';
                    return;
                }
                try {
                    const response = await fetch(`${API_URL}/api/blogs`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token.trim()}`
                        },
                        body: JSON.stringify({ title, category, content })
                    });
                    const data = await response.json();
                    if (response.status === 403 && data.message === 'Invalid token') {
                        alert('Session expired. Please log in again.');
                        localStorage.removeItem('token');
                        window.location.href = 'login.html';
                        return;
                    }
                    alert(response.ok ? 'Blog created!' : `Error: ${data.message || 'Unknown error'}`);
                    if (response.ok) window.location.href = 'index.html';
                } catch {
                    alert('Blog creation failed.');
                }
            });
        }
    }

    // Fetch and display blogs on index page
    if (window.location.pathname.endsWith('index.html')) {
        window.fetchAndRenderBlogs = async function (category = '') {
            try {
                const response = await fetch(`${API_URL}/api/blogs${category ? `?category=${category}` : ''}`);
                const blogs = await response.json();
                const blogsList = document.getElementById('blogsList');
                blogsList.innerHTML = blogs.map(blog => `
                    <div class="blog-card">
                        <h3><a href="blog.html?id=${blog.id}">${blog.title}</a></h3>
                        <p>By ${blog.username} on ${new Date(blog.created_at).toLocaleDateString()}</p>
                        <div class="metrics">
                            <span>Likes: ${blog.likes || 0}</span>
                            <span>Comments: ${blog.comment_count || 0}</span>
                            <span>Views: ${blog.views || 0}</span>
                        </div>
                    </div>
                `).join('');
            } catch {
                console.error('Error fetching blogs');
            }
        };
        fetchAndRenderBlogs();
    }

    // Fetch and display single blog with comments and replies
    if (window.location.pathname.endsWith('blog.html')) {
        const fetchBlog = async () => {
            const urlParams = new URLSearchParams(window.location.search);
            const blogId = urlParams.get('id');
            try {
                const response = await fetch(`${API_URL}/api/blogs/${blogId}`);
                const blog = await response.json();

                document.getElementById('blogTitle').textContent = blog.title;
                document.getElementById('blogAuthor').textContent = blog.username;
                document.getElementById('blogDate').textContent = new Date(blog.created_at).toLocaleDateString();
                document.getElementById('blogContent').innerHTML = blog.content;
                document.getElementById('likeCount').textContent = blog.likes || 0;

                const commentsList = document.getElementById('commentsList');
                const token = localStorage.getItem('token');

                const renderComments = (comments, parentElement) => {
                    comments.forEach(comment => {
                        const commentElement = document.createElement('div');
                        commentElement.classList.add('comment');
                        commentElement.innerHTML = `
                            <p>
                                <span class="comment-author">${comment.username}</span>
                                <span class="comment-date"> on ${new Date(comment.created_at).toLocaleDateString()}</span>
                            </p>
                            <p class="comment-content">${comment.content}</p>
                            <button class="reply-btn" id="replyBtn-${comment.id}">Reply</button>
                            <div class="reply-form-container" id="replyFormContainer-${comment.id}" style="display:none;">
                                <form class="reply-form" id="replyForm-${comment.id}">
                                    <textarea placeholder="Write your reply here..." required></textarea>
                                    <button type="submit">Submit Reply</button>
                                    <button type="button" class="cancel-reply">Cancel</button>
                                </form>
                            </div>
                            <div class="replies"></div>
                        `;
                        parentElement.appendChild(commentElement);

                        // Recursively render replies
                        if (comment.replies && comment.replies.length > 0) {
                            const repliesContainer = commentElement.querySelector('.replies');
                            renderComments(comment.replies, repliesContainer);
                        }

                        // Reply button toggle
                        const replyBtn = commentElement.querySelector('.reply-btn');
                        const replyFormContainer = commentElement.querySelector('.reply-form-container');
                        const replyForm = commentElement.querySelector('.reply-form');

                        replyBtn.addEventListener('click', () => {
                            if (!token) {
                                alert('Please log in to reply.');
                                window.location.href = 'login.html';
                                return;
                            }
                            replyFormContainer.style.display = 'block';
                        });

                        // Cancel reply button
                        replyForm.querySelector('.cancel-reply').addEventListener('click', () => {
                            replyFormContainer.style.display = 'none';
                            replyForm.querySelector('textarea').value = '';
                        });

                        // Reply submission
                        replyForm.addEventListener('submit', async (e) => {
                            e.preventDefault();
                            if (!token) {
                                alert('Please log in to reply.');
                                window.location.href = 'login.html';
                                return;
                            }
                            const replyContent = replyForm.querySelector('textarea').value.trim();
                            if (!replyContent) {
                                alert('Reply cannot be empty.');
                                return;
                            }
                            try {
                                const response = await fetch(`${API_URL}/api/blogs/${blogId}/comment/reply`, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': `Bearer ${token}`
                                    },
                                    body: JSON.stringify({
                                        content: replyContent,
                                        parent_id: comment.id
                                    })
                                });
                                const data = await response.json();
                                if (response.ok) {
                                    alert('Reply added!');
                                    replyForm.querySelector('textarea').value = '';
                                    replyFormContainer.style.display = 'none';
                                    fetchBlog();
                                } else {
                                    alert(`Failed to add reply: ${data.message || 'Unknown error'}`);
                                }
                            } catch {
                                alert('Failed to add reply.');
                            }
                        });
                    });
                };

                commentsList.innerHTML = '';
                renderComments(blog.comments || [], commentsList);

                // Comment form submission
                const commentForm = document.getElementById('commentForm');
                if (commentForm) {
                    commentForm.addEventListener('submit', async (e) => {
                        e.preventDefault();
                        if (!token) {
                            alert('Please log in to comment.');
                            window.location.href = 'login.html';
                            return;
                        }
                        const commentContent = commentForm.querySelector('textarea').value.trim();
                        if (!commentContent) {
                            alert('Comment cannot be empty.');
                            return;
                        }
                        try {
                            const response = await fetch(`${API_URL}/api/blogs/${blogId}/comment`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`
                                },
                                body: JSON.stringify({ content: commentContent })
                            });
                            const data = await response.json();
                            if (response.ok) {
                                alert('Comment added!');
                                commentForm.querySelector('textarea').value = '';
                                fetchBlog();
                            } else {
                                alert(`Failed to add comment: ${data.message || 'Unknown error'}`);
                            }
                        } catch {
                            alert('Failed to add comment.');
                        }
                    });
                }

                // Like button click
                const likeButton = document.getElementById('likeButton');
                if (likeButton) {
                    likeButton.addEventListener('click', async () => {
                        if (!token) {
                            alert('Please log in to like posts.');
                            window.location.href = 'login.html';
                            return;
                        }
                        try {
                            const response = await fetch(`${API_URL}/api/blogs/${blogId}/like`, {
                                method: 'POST',
                                headers: {
                                    'Authorization': `Bearer ${token}`
                                }
                            });
                            const data = await response.json();
                            if (response.ok) {
                                document.getElementById('likeCount').textContent = data.likes;
                            } else {
                                alert(data.message || 'Failed to like post.');
                            }
                        } catch {
                            alert('Failed to like post.');
                        }
                    });
                }

            } catch {
                alert('Failed to load blog.');
            }
        };

        fetchBlog();
    }
});
