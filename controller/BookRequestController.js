const BookRequestRepository = require('./../repository/BookRequestRepository');
const BorrowBookRepository = require('./../repository/BorrowBookRepository');
const BookRepository = require('./../repository/BookRepository');
const UserRepository = require('./../repository/UserRepository');
const NotificationRepository = require('./../repository/NotificationRepository');
const Book = require('../models/Book');
const { EXTEND, RESERVE, ACCEPTED, REJECTED, PROCESSING, BORROWED, UNAVAILABLE, AVAILABLE } = require('./../constant/constant');
const { ADMIN } = require("../constant/constant");

exports.findAllAvailableBorrowedBooksByUserId = async (req, res) => {
    const { userId } = req.body;
    const borrowedBooks = await BorrowBookRepository.findAllBorrowBook(userId);
    const bookRequests = await BookRequestRepository.findAllProcessingExtendBookRequestByUserId(userId);
    const bookIdListInBookRequests = bookRequests.map(bookRequest => bookRequest.book_id);
    // Exclude all processing books
    const filteredBorrowedBooks = borrowedBooks.filter(borrowBook => !bookIdListInBookRequests.includes(borrowBook.book_id));
    const mappedBorrowBookResults = filteredBorrowedBooks.map(result => {
        return {
            id: result.id,
            bookId: result.book_id,
            bookimg: result.book.book_detail.bookimg,
            title: result.book.book_detail.title,
            borrowDate: result.start_date,
            dueDate: result.due_date,
            returnDate: null,
            status: BORROWED,
        };
    });
    res.json(mappedBorrowBookResults);
}

exports.findBorrowBooksByUserIdAndBookId = (req, res) => {
    const { userId, bookId } = req.body;
    BorrowBookRepository.findAllBorrowBookByUserIdAndBookId(userId, bookId).then(borrowBooks => {
        const mappedBorrowBookResults = borrowBooks.map(result => {
            return {
                id: result.id,
                bookId: result.book_id,
                bookimg: result.book.book_detail.bookimg,
                title: result.book.book_detail.title,
                borrowDate: result.start_date,
                dueDate: result.due_date,
                returnDate: null,
                status: BORROWED,
            };
        });
        res.json(mappedBorrowBookResults);
    })
}

exports.createExtendBookRequest = async (req, res) => {
    const { userId, borrowBookIdList, url } = req.body;
    const type = EXTEND;
    const status = PROCESSING;
    try {
        const newBookRequests = [];
        for (let borrowBookId of borrowBookIdList) {
            const borrowBook = await BorrowBookRepository.findBorrowBookByPk(borrowBookId);
            const bookId = borrowBook.book_id;
            
            const newBookRequest = {
                user_id: userId,
                book_id: bookId,
                type,
                status,
            }
            newBookRequests.push(newBookRequest);
            
        }
        BookRequestRepository.bulkCreateBookRequest(newBookRequests).then(async result => {
            const allAdminUser = await UserRepository.findAllUserByRole(ADMIN);
            const allPromises = [];
            if (allAdminUser !== undefined) {
                allAdminUser.forEach(admin => {
                    const userId = admin.id;
                    const title = "New Book Request is available";
                    const desc = "1 new book request added";
                    const thumbnailUrl = "https://img.icons8.com/plasticine/2x/resize-diagonal.png";
                    allPromises.push(NotificationRepository.createNotification({ userId, title, desc, url, enablePush: true, priority: 'HIGH', thumbnailUrl }));
                });
            }
            Promise.all(allPromises).then(values=>{
                res.json({ success: true });
            });
        });
        
    } catch (err) {
        res.status(500).json({ err: err.toString() })
    }

}

exports.findAllExtendBookRequest = (req, res) => {
    BookRequestRepository.findAllExtendBookRequest().then(async bookRequests => {
        const pendingBookRequests = [];
        const completedBookRequests = [];
        await Promise.all(bookRequests.map(async bookRequest => {
            const borrowBooks = await BorrowBookRepository.findAllBorrowBookByUserIdAndBookId(bookRequest.user.id, bookRequest.book_id);
            const isBorrowBookExist = borrowBooks.length > 0;
            const item = {
                id: bookRequest.id,
                borrowBookId: isBorrowBookExist ? borrowBooks[0].id : null,
                bookId: bookRequest.book_id,
                bookimg: bookRequest.book.book_detail.bookimg,
                title: bookRequest.book.book_detail.title,
                requestCreatedDate: bookRequest.created,
                userId: bookRequest.user.id,
                username: bookRequest.user.first_name + bookRequest.user.last_name,
                status: bookRequest.status,
                startDate: isBorrowBookExist ? borrowBooks[0].start_date : null,
                dueDate: isBorrowBookExist ? borrowBooks[0].due_date : null,
            };
            if (item.status === PROCESSING) {
                pendingBookRequests.push(item);
            } else {
                completedBookRequests.push(item);
            }
        }));
        res.json({ pendingBookRequests, completedBookRequests });
    }).catch(err => {
        res.status(500).json({ err: err.toString() });
    })
}

exports.acceptExtendBookRequest = async (req, res) => {
    const { bookRequestId, newDueDate, url } = req.body;
    const status = ACCEPTED;
    const bookRequest = await BookRequestRepository.findBookRequestByPk(bookRequestId);
    try {
        BorrowBookRepository.extendDueDate(bookRequest.book_id, bookRequest.user_id, newDueDate).then(result => {
            BookRequestRepository.updateBookRequestStatus(bookRequestId, status).then(bookReqResult => {
                const userId = bookReqResult.user_id;
                const title = "Book Request have been accepted";
                const desc = "A book request have been accepted";
                const thumbnailUrl = "https://www.freeiconspng.com/thumbs/success-icon/success-icon-10.png";
                NotificationRepository.createNotification({ userId, title, desc, url, enablePush: true, priority: 'HIGH', thumbnailUrl });

                res.json({ success: true });
            });
        });

    } catch (err) {
        res.status(500).json({ err: err.toString() });
    }
}

exports.rejectExtendBookRequest = (req, res) => {
    const { bookRequestId, rejectReason, url } = req.body;
    const status = REJECTED;
    BookRequestRepository.updateBookRequestStatus(bookRequestId, status, rejectReason).then(bookReqResult => {
        const userId = bookReqResult.user_id;
        const title = "Book Request have been rejected";
        const desc = rejectReason;
        const thumbnailUrl = "https://www.pinclipart.com/picdir/middle/249-2495553_icon-failure-clipart.png";
        NotificationRepository.createNotification({ userId, title, desc, url, enablePush: true, priority: 'HIGH', thumbnailUrl });

        res.json({ success: true });
    }).catch(err => {
        console.log(err.toString());
        res.status(500).json({ err: err.toString() });
    })
}

exports.createReserveBookRequest = async (req, res) => {
    let { userId, bookId, reason } = req.body;
    const selectedBook = await BookRepository.findBookById(bookId);
    if (selectedBook === null) {
        res.status(404).json({ err: "Book does not exists" });
    }
    if (selectedBook.status.toUpperCase() === UNAVAILABLE) {
        // FIND ALTERNATIVE BOOK
        const availableBooks = await BookRepository.findAllAvailableBooksByBookDetailId(selectedBook.book_detail_id);
        if (availableBooks.length === 0) {
            res.status(404).json({ err: "The book is not available" });
        } else {
            bookId = availableBooks[0].id;
            const type = RESERVE;
            const status = PROCESSING;
            const newBookRequest = {
                user_id: userId,
                book_id: bookId,
                type,
                status,
                reason,
            }
            BookRequestRepository.createBookRequest(newBookRequest).then(result => {
                // make book unavailable 
                return BookRepository.updateBookStatus(bookId, UNAVAILABLE).then(book => {
                    res.json(result);
                });
            }).catch(err => {
                res.status(500).json({ err: err.toString() });
            });
        }
    }

}

exports.findPendingBookReservationByUserId = (req, res) => {
    const { userId } = req.body;
    BookRequestRepository.findAllPendingBookReservationRequestByUserId(userId).then(bookRequests => {
        const mappedResults = bookRequests.map(bookRequest => {
            return {
                id: bookRequest.id,
                bookId: bookRequest.book_id,
                title: bookRequest.book.book_detail.title,
                bookimg: bookRequest.book.book_detail.bookimg,
                requestCreatedDate: bookRequest.created,
                userId: bookRequest.user.id,
                username: bookRequest.user.first_name + bookRequest.user.last_name,
                status: bookRequest.status,
            };
        })
        res.json(mappedResults);
    }).catch(err => {
        res.status(500).json({ err: err.toString() });
    })
}


exports.findCompletedBookReservationByUserId = (req, res) => {
    const { userId } = req.body;
    BookRequestRepository.findAllCompletedBookReservationRequestByUserId(userId).then(bookRequests => {
        const mappedResults = bookRequests.map(bookRequest => {
            return {
                id: bookRequest.id,
                bookId: bookRequest.book_id,
                title: bookRequest.book.book_detail.title,
                bookimg: bookRequest.book.book_detail.bookimg,
                requestCreatedDate: bookRequest.created,
                userId: bookRequest.user.id,
                username: bookRequest.user.first_name + bookRequest.user.last_name,
                status: bookRequest.status,
            };
        })
        res.json(mappedResults);
    }).catch(err => {
        res.status(500).json({ err: err.toString() });
    })
}

exports.findAllPendingReserveBookRequest = (req, res) => {
    BookRequestRepository.findAllPendingBookReservationRequest().then(bookRequests => {
        const mappedResults = bookRequests.map(bookRequest => {
            return {
                id: bookRequest.id,
                bookId: bookRequest.book_id,
                title: bookRequest.book.book_detail.title,
                bookimg: bookRequest.book.book_detail.bookimg,
                requestCreatedDate: bookRequest.created,
                userId: bookRequest.user.id,
                username: bookRequest.user.first_name + bookRequest.user.last_name,
                status: bookRequest.status,
            };
        })
        res.json(mappedResults);
    }).catch(err => {
        res.status(500).json({ err: err.toString() });
    })
}

exports.findAllCompletedReserveBookRequest = (req, res) => {
    BookRequestRepository.findAllCompletedBookReservationRequest().then(bookRequests => {
        const mappedResults = bookRequests.map(bookRequest => {
            return {
                id: bookRequest.id,
                bookId: bookRequest.book_id,
                title: bookRequest.book.book_detail.title,
                bookimg: bookRequest.book.book_detail.bookimg,
                requestCreatedDate: bookRequest.created,
                userId: bookRequest.user.id,
                username: bookRequest.user.first_name + bookRequest.user.last_name,
                status: bookRequest.status,
            };
        })
        res.json(mappedResults);
    }).catch(err => {
        res.status(500).json({ err: err.toString() });
    })
}

exports.acceptBookReservationRequest = async (req, res) => {
    const { bookRequestId, startDate, dueDate } = req.body;
    const bookRequest = await BookRequestRepository.findBookRequestByPk(bookRequestId);
    BorrowBookRepository.createBorrowBook({ start_date: startDate, due_date: dueDate, book_id: bookRequest.book_id, user_id: bookRequest.user_id }).then(borrowBook => {
        return BookRequestRepository.updateBookRequestStatus(bookRequestId, ACCEPTED).then(result => {
            res.json({ success: true });
        });
    }).catch(err => {
        res.status(500).json({ err: err.toString() });
    });
}

exports.rejectBookReservationRequest = (req, res) => {
    // set book to available
    const { bookRequestId, rejectReason } = req.body;
    console.log(rejectReason);
    BookRequestRepository.updateBookRequestStatus(bookRequestId, REJECTED, rejectReason).then(bookRequest => {
        return BookRepository.updateBookStatus(bookRequest.book_id, AVAILABLE).then(book => {
            res.json({ success: true });
        });
    }).catch(err => {
        console.log(err);
        res.status(500).json({ err: err.toString() });
    });
}

exports.removeBookRequest = (req, res) => {
    const { bookRequestId } = req.body;
    BookRequestRepository.removeBookRequest(bookRequestId).then(bookRequest => {
        return BookRepository.updateBookStatus(bookRequest.book_id, AVAILABLE).then(book => {
            res.json(result);
        });
    }).catch(err => {
        res.status(500).json({ err: err.toString() });
    });
}
