const BookDetail = require("../models/BookDetail");
const BorrowBookHistory = require("../models/BorrowBookHistory");
const Book = require("../models/Book");
const BookRepository = require("../repository/BookRepository");

const BookDetailRepository = require("../repository/BookDetailRepository");
const AuthorRepository = require("../repository/AuthorRepository");

exports.getBook = (req, res) => {
    const searchCriteria = req.body.searchCriteria;
    const searchCriteriaType = req.body.searchCriteriaType;
    const genreId = req.body.genre;
    BookDetailRepository.getBookDetails(searchCriteria, searchCriteriaType, genreId).then(result => {
        res.json(result);
    }).catch(err=>{
        res.status(400).json({message: 'Error in getting the books',err:err.toString()});
    });
}

exports.getLatestBook = (req, res) => {
    BookDetailRepository.getThreeLatestBook().then(bookDetails => {
        res.json(bookDetails);
    }).catch(err => {
        res.status(400).json({message: 'Latest book cannot retrieve'});
    });
}

exports.updateBookDetails = async (req, res) => {
    const bookDetailId = req.body.id;
    const authorName = req.body.author;

    const bookDetailData = {
        title: req.body.title,
        isbn: req.body.isbn,
        genre_id: req.body.genreId,
        bookimg: req.body.bookimg,
        summary: req.body.summary,
        datepublished: req.body.datepublished,
        publisher: req.body.publisher,
        location: req.body.location,
    };
    const author = await AuthorRepository.findAuthorByName(authorName).then(author => {
        if (author) {
            return author;
        } else {
            return AuthorRepository.createAuthor(authorName).then(author => {
                return author;
            }).catch(err => {
                res.status(400).json({message: 'Add New Author Failed'});
            })
        }
    });


    if (author) {
        db.sequelize.transaction(t => {
            return BookDetail.findOne({where: {id: bookDetailId}, transaction: t}).then(bookDetail => {
                bookDetail.title = req.body.title;
                bookDetail.isbn = req.body.isbn;
                bookDetail.genre_id = req.body.genreId;
                bookDetail.bookimg = req.body.bookimg;
                bookDetail.summary = req.body.summary;
                bookDetail.datepublished = req.body.datepublished;
                bookDetail.publisher = req.body.publisher;
                bookDetail.location = req.body.location;
                bookDetail.addAuthor(author);
                bookDetail.save();
                return bookDetail;
                // return BookAuthor.findOne({where: {book_detail_id: bookDetailId}, transaction: t}).then(bookAuthor => {
                //     console.log(bookAuthor.author_id, authorId);
                //     if (bookAuthor && bookAuthor.author_id !== authorId) {
                //         console.log('updateeee');
                //         bookAuthor.author_id = authorId;
                //         bookAuthor.save();
                //         return res.json('Book Detail Updated Successfully');
                //     }
                //     return res.json('Book Detail Updated Successfully');
                // });
            });
        }).then(res=>{
            return res.json('Book Detail Updated Successfully');
        }).catch(err => {
            console.log(err);
            res.status(400).json({message: 'Book Detail Update Failed'});
        })
    } else {
        res.status(400).json({message: 'Author not found and cannot be created'});
    }

}

exports.deleteBook = async (req, res) => {
    const bookDetailId = req.body.id;
    const bookId = await BookRepository.findBookByBookDetailId.then(book => {
        if (book) {
            return book.id;
        }
    });
    db.sequelize.transaction(t => {
        if (bookId) {
            BorrowBookHistory.destroy({where: {book_id: bookId}, transaction: t});
        }
        return Book.destroy({where: {book_detail_id: bookDetailId}, transaction: t}).then(books => {
            return BookDetail.destroy({where: {id: bookDetailId}, transaction: t}).then(bookDetail => {
                console.log(bookDetail);
                if (bookDetail) {
                    res.json('Book Detail Deleted Successfully')
                } else {
                    res.status(400).json({message: 'Book Detail Delete Failed'});
                }
            });
        });
    }).catch(err => {
        console.log(err);
        res.status(400).json({message: 'Book Detail Delete Failed'});
    })


}
