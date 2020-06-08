const express = require('express');
const bookDetails = express.Router();
const BookDetail = require('../models/BookDetail');
const Book = require('../models/Book');
const Genre = require('../models/Genre');
const db = require('../database/db.js');

bookDetails.get('/get-all-book-details', (req, res) => {
  BookDetail.findAll({ include: [Genre] }).then(books => res.json(books));
});

bookDetails.get('/get-book/:book_id', (req, res) => {
  BookDetail.findOne({ include: [Genre], where: { id: req.params.book_id } }).then((book) => {
    res.json(book);
  });
});

bookDetails.post('/add', (req, res) => {
  const today = new Date();
  const data = {
    isbn: req.body.isbn,
    title: req.body.title,
    datepublished: req.body.datepublished,
    publisher: req.body.publisher,
    type: req.body.type,
    e_book: req.body.ebook,
    category_id: req.body.category,
    genre_id: req.body.genre,
    summary: req.body.summary,
    location: req.body.location,
    bookimg: req.body.bookimg,
    status: req.body.status,
    created: today,
  };
  BookDetail.create(data)
    .then((book) => {
      res.json({ status: 'book added' });
    })
    .catch((err) => {
      res.send('error: ' + err);
    });
});

bookDetails.post('/get-book-by-genre', (req, res) => {
  const requestGenre = req.body.genre;
  BookDetail.findAll({ include: [{ model: Genre, where: { name: requestGenre } }] }).then(books => {
    res.json(books);
  });
});

bookDetails.post('/get-book', (req, res) => {
  const searchCriteria = req.body.searchCriteria;
  const searchCriteriaType = req.body.searchCriteriaType;
  const genreId = req.body.genre;
  const a={};
  if (genreId) {
    a['genre_id'] = genreId;
  }
  if (searchCriteria) {
    a[searchCriteriaType] = searchCriteria;
  }

  BookDetail.findAll({include:[Genre,Book], where: a }).then(books => {
    res.json(books);
  })
});

module.exports = bookDetails;